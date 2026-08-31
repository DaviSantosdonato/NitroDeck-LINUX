use crate::{hwmon, model, sg};
use nitrodeck_core::{FanEntry, FanMode, FanReading, ProviderMeta, ProviderStatus};
use std::fs;

const NITRO_SENSE_FAN_SPEED: &str =
    "/sys/module/linuwu_sense/drivers/platform:acer-wmi/acer-wmi/nitro_sense/fan_speed";

// Nunca aceitamos um valor manual "quase parado": abaixo disso, ou é 0 (modo
// automático) ou nada. Não é um mínimo garantido pelo firmware (a Acer não
// documenta isso publicamente) — é uma margem de segurança conservadora
// nossa, ajustada para 25% a pedido do usuário (ruído da ventoinha em 31%
// incomodava), documentada aqui por não termos uma fonte oficial melhor.
const MIN_MANUAL_PERCENT: u8 = 25;

fn friendly_label(chip_name: &str, fan_name: &str) -> String {
    if chip_name == "acer" {
        match fan_name {
            "fan1_input" => return "Ventoinha CPU".to_string(),
            "fan2_input" => return "Ventoinha GPU".to_string(),
            _ => {}
        }
    }
    format!("{chip_name} {fan_name}")
}

fn read_control_state() -> (bool, FanMode, Option<u8>, Option<u8>) {
    let present = std::path::Path::new(NITRO_SENSE_FAN_SPEED).exists();
    if !present {
        return (false, FanMode::Auto, None, None);
    }
    let Some(raw) = sg::read_file(NITRO_SENSE_FAN_SPEED) else {
        // O arquivo existe (driver instalado), só não conseguimos ler agora.
        return (true, FanMode::Auto, None, None);
    };
    let parts: Vec<u8> = raw.trim().split(',').filter_map(|p| p.parse().ok()).collect();
    let (cpu, gpu) = match parts.as_slice() {
        [c, g] => (*c, *g),
        _ => return (true, FanMode::Auto, None, None),
    };
    if cpu == 0 && gpu == 0 {
        (true, FanMode::Auto, None, None)
    } else {
        (true, FanMode::Manual, Some(cpu), Some(gpu))
    }
}

pub fn read() -> FanReading {
    let mut fans = Vec::new();

    for chip in hwmon::chips() {
        let Ok(entries) = fs::read_dir(&chip.path) else {
            continue;
        };
        for entry in entries.flatten() {
            let fname = entry.file_name();
            let fname = fname.to_string_lossy();
            if !fname.ends_with("_input") || !fname.starts_with("fan") {
                continue;
            }
            if let Some(rpm) = hwmon::read_u64(&entry.path()) {
                fans.push(FanEntry {
                    label: friendly_label(&chip.name, &fname),
                    rpm: Some(rpm as f64),
                });
            }
        }
    }

    let monitoring_available = !fans.is_empty();
    let (control_present, mode, cpu_percent, gpu_percent) = read_control_state();
    let control_available = control_present && model::is_confirmed();

    let status = if monitoring_available {
        ProviderStatus::ReadOnly
    } else {
        ProviderStatus::Unavailable
    };

    let mut meta = ProviderMeta::new(status, "hwmon fan*_input, linuwu_sense nitro_sense");
    if !monitoring_available {
        meta = meta.with_detail(
            "Nenhum sensor fan*_input foi encontrado em nenhum chip hwmon deste notebook.",
        );
    } else if !control_available {
        meta = meta.with_detail(if control_present {
            format!(
                "Interface de controle encontrada, mas o modelo deste notebook não bate com o confirmado ({}) — controle desabilitado por segurança.",
                model::CONFIRMED_MODEL
            )
        } else {
            "Leitura de RPM disponível; controle manual requer o módulo linuwu_sense (não instalado ou não detectado).".to_string()
        });
    }

    FanReading {
        meta,
        monitoring_available,
        control_available,
        fans,
        mode,
        cpu_percent,
        gpu_percent,
        min_manual_percent: MIN_MANUAL_PERCENT,
    }
}

/// Define a velocidade manual das ventoinhas, ou volta ao automático quando
/// `cpu == 0 && gpu == 0`. Nunca escreve nada se o modelo não bater com o
/// único confirmado, ou se um valor estiver fora da faixa segura.
pub fn set_speed(cpu: u8, gpu: u8) -> Result<(), String> {
    if !model::is_confirmed() {
        return Err("Modelo de notebook não confirmado para controle de ventoinha.".to_string());
    }

    let is_auto = cpu == 0 && gpu == 0;
    let in_safe_range = |v: u8| v == 0 || (MIN_MANUAL_PERCENT..=100).contains(&v);
    if !is_auto && (!in_safe_range(cpu) || !in_safe_range(gpu)) {
        return Err(format!(
            "Valor fora da faixa segura (use 0 para automático, ou {MIN_MANUAL_PERCENT}-100)."
        ));
    }

    sg::write_file(NITRO_SENSE_FAN_SPEED, &format!("{cpu},{gpu}"))
}

/// Chamado no encerramento do app (best-effort) para nunca deixar a
/// ventoinha travada num valor manual se a UI fechar.
pub fn revert_to_auto_best_effort() {
    let _ = set_speed(0, 0);
}
