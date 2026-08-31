use crate::hwmon;
use nitrodeck_core::{CpuReading, ProviderMeta, ProviderStatus};
use std::fs;
use std::time::Instant;

#[derive(Clone, Copy, Default)]
pub struct CpuTimes {
    idle: u64,
    total: u64,
}

fn parse_cpu_line(line: &str) -> Option<CpuTimes> {
    let mut parts = line.split_whitespace();
    parts.next()?; // "cpu" ou "cpuN"
    let nums: Vec<u64> = parts.filter_map(|p| p.parse().ok()).collect();
    if nums.len() < 4 {
        return None;
    }
    let (user, nice, system, idle) = (nums[0], nums[1], nums[2], nums[3]);
    let iowait = *nums.get(4).unwrap_or(&0);
    let irq = *nums.get(5).unwrap_or(&0);
    let softirq = *nums.get(6).unwrap_or(&0);
    let steal = *nums.get(7).unwrap_or(&0);
    let idle_total = idle + iowait;
    let total = user + nice + system + idle_total + irq + softirq + steal;
    Some(CpuTimes {
        idle: idle_total,
        total,
    })
}

struct ProcStat {
    total: Option<CpuTimes>,
    per_core: Vec<CpuTimes>,
}

fn read_proc_stat() -> Option<ProcStat> {
    let content = fs::read_to_string("/proc/stat").ok()?;
    let mut total = None;
    let mut per_core = Vec::new();
    for line in content.lines() {
        if line.starts_with("cpu ") {
            total = parse_cpu_line(line);
        } else if line.starts_with("cpu") {
            if let Some(t) = parse_cpu_line(line) {
                per_core.push(t);
            }
        } else {
            break;
        }
    }
    Some(ProcStat { total, per_core })
}

fn delta_usage_pct(prev: CpuTimes, cur: CpuTimes) -> Option<f64> {
    let total_delta = cur.total.checked_sub(prev.total)?;
    if total_delta == 0 {
        return None;
    }
    let idle_delta = cur.idle.saturating_sub(prev.idle);
    let busy = total_delta.saturating_sub(idle_delta);
    Some((busy as f64 / total_delta as f64) * 100.0)
}

fn read_cpu_identity() -> (String, u32, u32) {
    let content = fs::read_to_string("/proc/cpuinfo").unwrap_or_default();
    let mut model = String::from("CPU não identificada");
    let mut threads = 0u32;
    let mut cores_field: Option<u32> = None;
    for line in content.lines() {
        if let Some(v) = line.strip_prefix("model name") {
            if let Some(val) = v.split(':').nth(1) {
                model = val.trim().to_string();
            }
        } else if line.starts_with("processor") {
            threads += 1;
        } else if cores_field.is_none() {
            if let Some(v) = line.strip_prefix("cpu cores") {
                if let Some(val) = v.split(':').nth(1) {
                    cores_field = val.trim().parse().ok();
                }
            }
        }
    }
    let cores = cores_field.unwrap_or(threads);
    (model, cores, threads)
}

fn read_freq_mhz() -> Option<f64> {
    let mut total = 0u64;
    let mut count = 0u64;
    for entry in fs::read_dir("/sys/devices/system/cpu").ok()?.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        let Some(rest) = name.strip_prefix("cpu") else {
            continue;
        };
        if rest.parse::<u32>().is_err() {
            continue;
        }
        let path = entry.path().join("cpufreq/scaling_cur_freq");
        if let Some(khz) = hwmon::read_u64(&path) {
            total += khz;
            count += 1;
        }
    }
    if count == 0 {
        return None;
    }
    Some((total as f64 / count as f64) / 1000.0)
}

// Intel usa o chip "coretemp" com a sonda "Package id 0"; AMD usa "k10temp"
// com "Tctl" (throttle control, o valor que a própria AMD recomenda expor
// como temperatura da CPU) ou "Tdie" como alternativa em chips mais
// antigos. Tentamos os dois, sem assumir fabricante.
fn read_package_temp_c() -> Option<f64> {
    for chip in hwmon::chips() {
        let wanted_labels: &[&str] = match chip.name.as_str() {
            "coretemp" => &["Package id 0"],
            "k10temp" => &["Tctl", "Tdie"],
            _ => continue,
        };
        let Ok(entries) = fs::read_dir(&chip.path) else {
            continue;
        };
        for entry in entries.flatten() {
            let fname = entry.file_name();
            let fname = fname.to_string_lossy();
            let Some(prefix) = fname.strip_suffix("_label") else {
                continue;
            };
            let Ok(label) = fs::read_to_string(entry.path()) else {
                continue;
            };
            if wanted_labels.contains(&label.trim()) {
                let input_path = chip.path.join(format!("{prefix}_input"));
                if let Some(v) = hwmon::read_u64(&input_path) {
                    return Some(v as f64 / 1000.0);
                }
            }
        }
    }
    None
}

// RAPL (powercap) existe tanto em Intel (`intel-rapl:N`) quanto em kernels
// recentes com AMD (`amd-rapl` a partir do Linux 6.11) — em vez de fixar o
// nome do zone, procuramos a primeira zona cujo `name` seja "package-N",
// que é o domínio de pacote inteiro em qualquer um dos dois.
fn find_rapl_package_zone() -> Option<std::path::PathBuf> {
    let entries = fs::read_dir("/sys/class/powercap").ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        let name = fs::read_to_string(path.join("name")).ok()?;
        if name.trim().starts_with("package-") {
            return Some(path);
        }
    }
    None
}

fn read_rapl_energy_uj() -> Option<u64> {
    let zone = find_rapl_package_zone()?;
    hwmon::read_u64(&zone.join("energy_uj"))
}

const GOVERNOR_PATH: &str = "/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor";
const AVAILABLE_GOVERNORS_PATH: &str =
    "/sys/devices/system/cpu/cpu0/cpufreq/scaling_available_governors";

fn read_governor_info() -> (Option<String>, Vec<String>) {
    let governor = fs::read_to_string(GOVERNOR_PATH)
        .ok()
        .map(|s| s.trim().to_string());
    let available = fs::read_to_string(AVAILABLE_GOVERNORS_PATH)
        .ok()
        .map(|s| s.split_whitespace().map(|v| v.to_string()).collect())
        .unwrap_or_default();
    (governor, available)
}

/// Aplica o governor de frequência (ex.: "performance"/"powersave") em todos
/// os núcleos. Interface padrão do kernel (cpufreq), não específica deste
/// notebook — segura em qualquer hardware Linux com cpufreq. Exige root
/// (pkexec) porque a escrita em `scaling_governor` é root:root por padrão.
pub fn set_governor(governor: &str) -> Result<(), String> {
    let (_, available) = read_governor_info();
    if !available.iter().any(|g| g == governor) {
        return Err(format!(
            "Governor \"{governor}\" não está entre os suportados por este CPU."
        ));
    }
    let script = format!(
        "for f in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do echo '{governor}' > \"$f\"; done"
    );
    let output = std::process::Command::new("pkexec")
        .arg("bash")
        .arg("-c")
        .arg(&script)
        .output()
        .map_err(|e| format!("Falha ao executar pkexec: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "Falha ao aplicar governor: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}

const NO_TURBO_PATH: &str = "/sys/devices/system/cpu/intel_pstate/no_turbo";
// Presente em qualquer CPU com cpufreq, Intel (acpi-cpufreq) ou AMD
// (acpi-cpufreq/amd-pstate) — usado como alternativa quando não há
// intel_pstate. Semântica oposta ao no_turbo: 1 = boost ligado.
const CPUFREQ_BOOST_PATH: &str = "/sys/devices/system/cpu/cpufreq/boost";

fn read_turbo() -> Option<bool> {
    if let Ok(raw) = fs::read_to_string(NO_TURBO_PATH) {
        return Some(raw.trim() == "0");
    }
    let raw = fs::read_to_string(CPUFREQ_BOOST_PATH).ok()?;
    Some(raw.trim() == "1")
}

fn read_rapl_limit_w(constraint: u8) -> Option<f64> {
    let zone = find_rapl_package_zone()?;
    hwmon::read_u64(&zone.join(format!("constraint_{constraint}_power_limit_uw")))
        .map(|uw| uw as f64 / 1_000_000.0)
}

// Faixa segura por escolha nossa (conservadora), não um limite garantido pelo
// fabricante — este chip roda um TDP configurável pela Acer bem acima do
// nominal da Intel para essa classe (i5-13420H), então usamos uma margem
// acima do que a própria EC já configura, sem deixar o usuário colocar um
// valor absurdo por engano.
const POWER_LIMIT_MIN_W: f64 = 10.0;
const POWER_LIMIT_MAX_W: f64 = 65.0; // PL1 (long_term)
const POWER_LIMIT_PL2_MAX_W: f64 = 140.0; // PL2 (short_term) pode ir mais alto, é só pico curto

/// Ativa/desativa o Turbo Boost. Usa `intel_pstate/no_turbo` quando
/// disponível (Intel), ou o `cpufreq/boost` genérico (AMD e Intel sem
/// intel_pstate) como alternativa — os dois têm polaridade oposta, cada um
/// escreve o valor certo pro seu próprio arquivo. Exige root (pkexec).
pub fn set_turbo(enabled: bool) -> Result<(), String> {
    let (path, value) = if std::path::Path::new(NO_TURBO_PATH).exists() {
        (NO_TURBO_PATH, if enabled { "0" } else { "1" })
    } else if std::path::Path::new(CPUFREQ_BOOST_PATH).exists() {
        (CPUFREQ_BOOST_PATH, if enabled { "1" } else { "0" })
    } else {
        return Err("Este CPU não expõe controle de Turbo Boost.".to_string());
    };

    let output = std::process::Command::new("pkexec")
        .arg("bash")
        .arg("-c")
        .arg(format!("echo '{value}' > '{path}'"))
        .output()
        .map_err(|e| format!("Falha ao executar pkexec: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "Falha ao mudar Turbo Boost: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}

/// Ajusta os limites de potência RAPL (PL1 = sustentado, PL2 = pico curto).
/// Isso é o equivalente real a "overclock" neste notebook: eleva o teto de
/// potência que a EC permite ao CPU sustentar, dentro da proteção térmica do
/// próprio silício (o CPU sempre pode se auto-limitar por temperatura,
/// independente do que configurarmos aqui). Passe `None` para não mexer
/// naquele limite específico.
pub fn set_power_limits(pl1_w: Option<f64>, pl2_w: Option<f64>) -> Result<(), String> {
    if let Some(w) = pl1_w {
        if !(POWER_LIMIT_MIN_W..=POWER_LIMIT_MAX_W).contains(&w) {
            return Err(format!(
                "PL1 fora da faixa seguras ({POWER_LIMIT_MIN_W}-{POWER_LIMIT_MAX_W}W)."
            ));
        }
    }
    if let Some(w) = pl2_w {
        if !(POWER_LIMIT_MIN_W..=POWER_LIMIT_PL2_MAX_W).contains(&w) {
            return Err(format!(
                "PL2 fora da faixa segura ({POWER_LIMIT_MIN_W}-{POWER_LIMIT_PL2_MAX_W}W)."
            ));
        }
    }
    if pl1_w.is_none() && pl2_w.is_none() {
        return Err("Nenhum limite informado.".to_string());
    }
    let zone = find_rapl_package_zone()
        .ok_or_else(|| "Este CPU não expõe RAPL/powercap — limite de potência indisponível.".to_string())?;
    let zone = zone.display();

    let mut script = String::new();
    if let Some(w) = pl1_w {
        let uw = (w * 1_000_000.0) as u64;
        script.push_str(&format!("echo '{uw}' > '{zone}/constraint_0_power_limit_uw'; "));
    }
    if let Some(w) = pl2_w {
        let uw = (w * 1_000_000.0) as u64;
        script.push_str(&format!("echo '{uw}' > '{zone}/constraint_1_power_limit_uw'; "));
    }

    let output = std::process::Command::new("pkexec")
        .arg("bash")
        .arg("-c")
        .arg(&script)
        .output()
        .map_err(|e| format!("Falha ao executar pkexec: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "Falha ao aplicar limite de potência: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}

#[derive(Default)]
pub struct CpuState {
    prev_total: Option<(CpuTimes, Instant)>,
    prev_per_core: Vec<CpuTimes>,
    prev_rapl: Option<(u64, Instant)>,
}

pub fn read(state: &mut CpuState) -> CpuReading {
    let (model, cores, threads) = read_cpu_identity();
    let stat = read_proc_stat();
    let now = Instant::now();

    let usage_pct = match (&state.prev_total, stat.as_ref().and_then(|s| s.total)) {
        (Some((prev, _)), Some(cur)) => delta_usage_pct(*prev, cur),
        _ => None,
    };

    let per_core_usage: Vec<f64> = match &stat {
        Some(s)
            if !state.prev_per_core.is_empty()
                && state.prev_per_core.len() == s.per_core.len() =>
        {
            s.per_core
                .iter()
                .zip(state.prev_per_core.iter())
                .filter_map(|(cur, prev)| delta_usage_pct(*prev, *cur))
                .collect()
        }
        _ => Vec::new(),
    };

    if let Some(s) = &stat {
        if let Some(total) = s.total {
            state.prev_total = Some((total, now));
        }
        state.prev_per_core = s.per_core.clone();
    }

    let freq_mhz = read_freq_mhz();
    let package_temp_c = read_package_temp_c();
    let (governor, available_governors) = read_governor_info();
    let turbo_enabled = read_turbo();
    let power_limit_pl1_w = read_rapl_limit_w(0);
    let power_limit_pl2_w = read_rapl_limit_w(1);

    let energy_now = read_rapl_energy_uj();
    let package_power_w = match (state.prev_rapl, energy_now) {
        (Some((prev_e, prev_t)), Some(cur_e)) if cur_e >= prev_e => {
            let dt = now.duration_since(prev_t).as_secs_f64();
            if dt > 0.05 {
                Some(((cur_e - prev_e) as f64 / 1_000_000.0) / dt)
            } else {
                None
            }
        }
        _ => None,
    };
    if let Some(e) = energy_now {
        state.prev_rapl = Some((e, now));
    }

    let status = if stat.is_some() {
        ProviderStatus::ReadOnly
    } else {
        ProviderStatus::Error
    };
    let meta = ProviderMeta::new(
        status,
        "/proc/stat, /proc/cpuinfo, hwmon coretemp, intel-rapl",
    );

    CpuReading {
        meta,
        model,
        cores,
        threads,
        usage_pct,
        per_core_usage,
        freq_mhz,
        package_temp_c,
        package_power_w,
        governor,
        available_governors,
        turbo_enabled,
        power_limit_pl1_w,
        power_limit_pl2_w,
        power_limit_min_w: POWER_LIMIT_MIN_W,
        power_limit_pl1_max_w: POWER_LIMIT_MAX_W,
        power_limit_pl2_max_w: POWER_LIMIT_PL2_MAX_W,
    }
}
