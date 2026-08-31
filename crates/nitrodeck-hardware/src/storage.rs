use crate::hwmon;
use nitrodeck_core::{ProviderMeta, ProviderStatus, SmartResult, StorageDevice, StorageReading};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

fn read_model(block_name: &str) -> String {
    // "nvme0n1" -> controlador "nvme0" (tudo antes do último 'n', que separa o namespace)
    if block_name.starts_with("nvme") {
        if let Some(last_n) = block_name.rfind('n') {
            if last_n > 0 {
                let ctrl = &block_name[..last_n];
                if let Ok(m) = fs::read_to_string(format!("/sys/class/nvme/{ctrl}/model")) {
                    return m.trim().to_string();
                }
            }
        }
    }
    fs::read_to_string(format!("/sys/block/{block_name}/device/model"))
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| block_name.to_string())
}

fn read_size_gb(block_name: &str) -> f64 {
    let sectors: f64 = hwmon::read_u64(std::path::Path::new(&format!(
        "/sys/block/{block_name}/size"
    )))
    .unwrap_or(0) as f64;
    (sectors * 512.0) / 1_000_000_000.0
}

/// Endereço "canônico" do dispositivo físico por trás de um nome de bloco —
/// usado só pra correlacionar com o sensor de temperatura certo em
/// `read_temp_c`, nunca exposto na UI.
fn device_real_path(block_name: &str) -> Option<PathBuf> {
    if block_name.starts_with("nvme") {
        let last_n = block_name.rfind('n')?;
        if last_n == 0 {
            return None;
        }
        let ctrl = &block_name[..last_n];
        fs::canonicalize(format!("/sys/class/nvme/{ctrl}")).ok()
    } else {
        fs::canonicalize(format!("/sys/block/{block_name}/device")).ok()
    }
}

/// Temperatura real do disco físico — via hwmon `nvme` pra NVMe, ou
/// `drivetemp` (módulo padrão do kernel pra SATA/SAS/USB com SMART) pra
/// discos comuns. Correlaciona pelo caminho real do dispositivo, então
/// funciona certo com múltiplos discos (cada um pega o sensor dele, não o
/// de outro).
fn read_temp_c(block_name: &str) -> Option<f64> {
    let target = device_real_path(block_name)?;
    for chip in hwmon::chips() {
        if chip.name != "nvme" && chip.name != "drivetemp" {
            continue;
        }
        let Ok(chip_device) = fs::canonicalize(chip.path.join("device")) else {
            continue;
        };
        if chip_device != target {
            continue;
        }
        if let Some(v) = hwmon::read_u64(&chip.path.join("temp1_input")) {
            return Some(v as f64 / 1000.0);
        }
    }
    None
}

/// Uso real desse disco físico — soma o espaço usado/total de todas as
/// partições montadas nele (via `lsblk`), não o uso de "/" aplicado cegamente
/// a todo mundo. Discos sem nada montado (ex.: um HD extra só de backup
/// desmontado) voltam `None` em vez de mostrar um número enganoso. Também
/// devolve os pontos de montagem, pra UI oferecer TRIM no lugar certo.
fn read_usage_and_mountpoints(block_name: &str) -> (Option<f64>, Vec<String>) {
    let output = Command::new("lsblk")
        .args(["-b", "-n", "-o", "MOUNTPOINT,FSSIZE,FSUSED", &format!("/dev/{block_name}")])
        .output();
    let Ok(output) = output else {
        return (None, Vec::new());
    };
    if !output.status.success() {
        return (None, Vec::new());
    }
    let text = String::from_utf8_lossy(&output.stdout);

    let mut total_size: u64 = 0;
    let mut total_used: u64 = 0;
    let mut mountpoints = Vec::new();
    for line in text.lines() {
        let mut parts = line.split_whitespace();
        let Some(mountpoint) = parts.next() else { continue };
        if mountpoint.is_empty() {
            continue;
        }
        mountpoints.push(mountpoint.to_string());
        let Some(size) = parts.next().and_then(|s| s.parse::<u64>().ok()) else {
            continue;
        };
        let Some(used) = parts.next().and_then(|s| s.parse::<u64>().ok()) else {
            continue;
        };
        total_size += size;
        total_used += used;
    }

    let used_pct = if total_size == 0 {
        None
    } else {
        Some((total_used as f64 / total_size as f64) * 100.0)
    };
    (used_pct, mountpoints)
}

fn list_block_devices() -> Vec<String> {
    let mut devices = Vec::new();
    let Ok(entries) = fs::read_dir("/sys/block") else {
        return devices;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with("nvme") || name.starts_with("sd") || name.starts_with("mmcblk") {
            // ignora partições: dispositivos "de verdade" não têm o arquivo "partition"
            if !entry.path().join("partition").exists() {
                devices.push(name);
            }
        }
    }
    devices.sort();
    devices
}

pub fn read() -> StorageReading {
    let names = list_block_devices();

    let devices: Vec<StorageDevice> = names
        .into_iter()
        .map(|name| {
            let (used_pct, mountpoints) = read_usage_and_mountpoints(&name);
            StorageDevice {
                model: read_model(&name),
                size_gb: read_size_gb(&name),
                used_pct,
                temp_c: read_temp_c(&name),
                wear_pct: None,
                smart_ok: None,
                mountpoints,
                name,
            }
        })
        .collect();

    let status = if devices.is_empty() {
        ProviderStatus::Error
    } else {
        ProviderStatus::ReadOnly
    };

    StorageReading {
        meta: ProviderMeta::new(status, "/sys/block, lsblk, hwmon nvme/drivetemp")
            .with_detail("Uso é por disco físico (soma das partições montadas nele), não o mesmo valor pra todos. SMART e desgaste ficam na aba, sob demanda — pedem sua senha (smartctl precisa de acesso root ao dispositivo bruto)."),
        devices,
    }
}

/// Checagem SMART sob demanda — nunca automática, porque cada checagem pede
/// sua senha via pkexec, então não faz sentido rodar isso a cada 2s como o
/// resto do snapshot.
pub fn check_smart(device: &str) -> Result<SmartResult, String> {
    if !list_block_devices().contains(&device.to_string()) {
        return Err("Dispositivo não reconhecido.".to_string());
    }
    let path = format!("/dev/{device}");
    let output = Command::new("pkexec")
        .args(["smartctl", "--json", "-H", "-A"])
        .arg(&path)
        .output()
        .map_err(|e| format!("Falha ao executar smartctl: {e}"))?;

    // smartctl retorna exit code != 0 pra vários avisos que não são erro
    // real (ex.: bits de "old age"); a saída JSON continua válida, então
    // sempre tentamos interpretar o stdout primeiro.
    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|_| "Não foi possível interpretar a saída do smartctl (dispositivo pode não suportar SMART).".to_string())?;

    let healthy = json["smart_status"]["passed"].as_bool();
    let wear_pct = json["endurance_used"]["current_percent"]
        .as_u64()
        .map(|v| v as u32);

    if healthy.is_none() && wear_pct.is_none() {
        return Err("Este dispositivo não expôs dados de SMART utilizáveis.".to_string());
    }

    Ok(SmartResult { healthy, wear_pct })
}

/// Executa fstrim numa partição montada — manutenção padrão e segura de
/// SSD/NVMe (o kernel já ignora blocos não alocados por conta própria;
/// isso só força a operação na hora). Precisa de root porque fstrim exige
/// CAP_SYS_ADMIN.
pub fn run_fstrim(mountpoint: &str) -> Result<String, String> {
    let output = Command::new("pkexec")
        .args(["fstrim", "-v"])
        .arg(mountpoint)
        .output()
        .map_err(|e| format!("Falha ao executar fstrim: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "Falha ao executar TRIM: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
