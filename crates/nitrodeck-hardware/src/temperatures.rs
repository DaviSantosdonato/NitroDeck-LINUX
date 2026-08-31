use crate::hwmon;
use nitrodeck_core::{ProviderMeta, ProviderStatus, TempSensor, TemperaturesReading};
use std::fs;

fn friendly_chip_name(chip: &str) -> &str {
    match chip {
        "coretemp" => "CPU",
        "acpitz" => "Placa-mãe",
        "nvme" => "SSD",
        "acer" => "Chassi (EC)",
        "amdgpu" => "GPU",
        c if c.starts_with("mt7921") || c.starts_with("iwlwifi") || c.starts_with("rtw") => "Wi-Fi",
        other => other,
    }
}

/// Lista toda sonda temp*_input de todo chip hwmon, somente leitura. Sem
/// isso um sensor sem `_label` vira "temp1"/"temp2" — melhor que nada, mas
/// nomeamos o chip para dar contexto.
pub fn read() -> TemperaturesReading {
    let mut sensors = Vec::new();

    for chip in hwmon::chips() {
        let Ok(entries) = fs::read_dir(&chip.path) else {
            continue;
        };
        let mut inputs: Vec<_> = entries
            .flatten()
            .filter_map(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                let base = name.strip_suffix("_input")?.to_string();
                if !base.starts_with("temp") {
                    return None;
                }
                Some((base, e.path()))
            })
            .collect();
        inputs.sort_by(|a, b| a.0.cmp(&b.0));

        for (base, path) in inputs {
            let Some(raw) = hwmon::read_u64(&path) else {
                continue;
            };
            let temp_c = raw as f64 / 1000.0;
            if !(-20.0..=150.0).contains(&temp_c) {
                continue; // leitura absurda, ignora em vez de mostrar lixo
            }
            let label_path = chip.path.join(format!("{base}_label"));
            let probe_label = fs::read_to_string(&label_path)
                .ok()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or(base);
            sensors.push(TempSensor {
                label: format!("{} — {}", friendly_chip_name(&chip.name), probe_label),
                temp_c,
            });
        }
    }

    let status = if sensors.is_empty() {
        ProviderStatus::Unavailable
    } else {
        ProviderStatus::ReadOnly
    };

    TemperaturesReading {
        meta: ProviderMeta::new(status, "hwmon temp*_input (todos os chips)"),
        sensors,
    }
}
