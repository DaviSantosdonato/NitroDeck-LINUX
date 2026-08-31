use crate::hwmon;
use nitrodeck_core::{ProviderMeta, ProviderStatus, StorageDevice, StorageReading};
use std::fs;
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

fn read_nvme_temp_c() -> Option<f64> {
    for chip in hwmon::chips() {
        if chip.name == "nvme" {
            if let Some(v) = hwmon::read_u64(&chip.path.join("temp1_input")) {
                return Some(v as f64 / 1000.0);
            }
        }
    }
    None
}

fn read_used_pct_root() -> Option<f64> {
    let output = Command::new("df").args(["--output=pcent", "/"]).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let last_line = text.lines().nth(1)?.trim().trim_end_matches('%');
    last_line.parse().ok()
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
    let used_pct_root = read_used_pct_root();
    let temp_c = read_nvme_temp_c();

    let devices: Vec<StorageDevice> = names
        .into_iter()
        .map(|name| StorageDevice {
            model: read_model(&name),
            size_gb: read_size_gb(&name),
            used_pct: used_pct_root,
            temp_c: if name.starts_with("nvme") { temp_c } else { None },
            wear_pct: None,
            smart_ok: None,
            name,
        })
        .collect();

    let status = if devices.is_empty() {
        ProviderStatus::Error
    } else {
        ProviderStatus::ReadOnly
    };

    StorageReading {
        meta: ProviderMeta::new(status, "/sys/block, hwmon nvme, df")
            .with_detail("SMART e desgaste (wear) exigem privilégio (smartctl) e chegam na Fase 5, via daemon."),
        devices,
    }
}
