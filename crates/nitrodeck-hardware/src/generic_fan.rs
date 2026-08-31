//! Controle de ventoinha via a interface padrão e documentada do kernel
//! Linux (`hwmon` `pwmN`/`pwmN_enable` — ver
//! Documentation/hwmon/sysfs-interface.rst). Isso é diferente do caminho
//! específico da Acer (`fans.rs`, via `linuwu_sense`/WMI): aqui não há
//! nenhuma engenharia reversa nem código específico de fabricante — é o
//! mesmo mecanismo que sensors/fancontrol usam há décadas, presente em
//! várias placas-mãe (chips nct6775/it87) e alguns notebooks (ex.:
//! `dell-smm-hwmon`). Por ser uma interface genérica e documentada, não
//! exige confirmação de modelo como o caminho da Acer exige — mas ainda
//! assim nunca aceita valores fora de uma faixa seg
//! ura e pede root de verdade (a escrita é root:root por padrão).

use std::fs;
use std::path::PathBuf;

// Mesmo espírito do piso de segurança da Acer: nunca aceitar um valor
// manual "quase parado" sem ser explicitamente 0 (que aqui significa
// "devolver para automático", não "desligar a ventoinha").
const MIN_MANUAL_PERCENT: u8 = 25;

pub struct PwmChannel {
    pub id: String,
    pub label: String,
    pub percent: Option<u8>,
    pub is_manual: bool,
}

fn chip_pwm_indices(chip_path: &std::path::Path) -> Vec<u32> {
    let Ok(entries) = fs::read_dir(chip_path) else {
        return Vec::new();
    };
    let mut out: Vec<u32> = entries
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let n = name.strip_prefix("pwm")?;
            n.parse::<u32>().ok()
        })
        .collect();
    out.sort_unstable();
    out
}

fn read_percent(chip_path: &std::path::Path, idx: u32) -> Option<u8> {
    let raw = crate::hwmon::read_u64(&chip_path.join(format!("pwm{idx}")))?;
    Some(((raw.min(255) as f64 / 255.0) * 100.0).round() as u8)
}

fn read_is_manual(chip_path: &std::path::Path, idx: u32) -> bool {
    // Convenção do kernel: 0 = desligado, 1 = manual (nós escrevemos), 2+ =
    // automático/controlado pelo firmware ou por uma curva do driver.
    crate::hwmon::read_u64(&chip_path.join(format!("pwm{idx}_enable")))
        .map(|v| v == 1)
        .unwrap_or(false)
}

/// Descobre canais PWM graváveis em qualquer chip hwmon, exceto o `acer`
/// (esse já tem seu próprio caminho dedicado e mais seguro via WMI).
pub fn discover() -> Vec<PwmChannel> {
    let mut out = Vec::new();
    for chip in crate::hwmon::chips() {
        if chip.name == "acer" {
            continue;
        }
        for idx in chip_pwm_indices(&chip.path) {
            let enable_path = chip.path.join(format!("pwm{idx}_enable"));
            let pwm_path = chip.path.join(format!("pwm{idx}"));
            if !pwm_path.exists() || !enable_path.exists() {
                continue;
            }
            out.push(PwmChannel {
                id: format!("{}:{idx}", chip.path.display()),
                label: format!("{} PWM{idx}", chip.name),
                percent: read_percent(&chip.path, idx),
                is_manual: read_is_manual(&chip.path, idx),
            });
        }
    }
    out
}

fn parse_id(id: &str) -> Option<(PathBuf, u32)> {
    let (path, idx) = id.rsplit_once(':')?;
    Some((PathBuf::from(path), idx.parse().ok()?))
}

/// Define a velocidade de um canal PWM (0 = volta pro automático,
/// `MIN_MANUAL_PERCENT`-100 = manual). Sempre via pkexec — a escrita em
/// `pwmN`/`pwmN_enable` é root:root por padrão no kernel.
pub fn set_percent(id: &str, percent: u8) -> Result<(), String> {
    let (chip_path, idx) = parse_id(id).ok_or_else(|| "Identificador de ventoinha inválido.".to_string())?;
    if percent != 0 && !(MIN_MANUAL_PERCENT..=100).contains(&percent) {
        return Err(format!(
            "Valor fora da faixa segura (use 0 para automático, ou {MIN_MANUAL_PERCENT}-100)."
        ));
    }

    let enable_path = chip_path.join(format!("pwm{idx}_enable"));
    let pwm_path = chip_path.join(format!("pwm{idx}"));

    let script = if percent == 0 {
        format!("echo '2' > '{}'", enable_path.display())
    } else {
        let raw = ((percent as f64 / 100.0) * 255.0).round() as u32;
        format!(
            "echo '1' > '{}'; echo '{raw}' > '{}'",
            enable_path.display(),
            pwm_path.display()
        )
    };

    let output = std::process::Command::new("pkexec")
        .arg("bash")
        .arg("-c")
        .arg(&script)
        .output()
        .map_err(|e| format!("Falha ao executar pkexec: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "Falha ao ajustar ventoinha: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}

/// Chamado no encerramento do app (best-effort): devolve todo canal PWM
/// manual para automático, igual já fazemos para a Acer.
pub fn revert_all_to_auto_best_effort() {
    for ch in discover() {
        if ch.is_manual {
            let _ = set_percent(&ch.id, 0);
        }
    }
}
