use crate::{model, sg};
use nitrodeck_core::{ExtrasReading, ProviderMeta, ProviderStatus, ToggleFeature, UsbChargingFeature};
use std::fs;

const BASE: &str = "/sys/module/linuwu_sense/drivers/platform:acer-wmi/acer-wmi/nitro_sense";

fn path(field: &str) -> String {
    format!("{BASE}/{field}")
}

/// Campos root:linuwu_sense (0660) — legíveis/graváveis via `sg`, sem root.
const GROUP_FIELDS: &[&str] = &["battery_calibration", "battery_limiter", "usb_charging"];
/// Campos root:root (0644) — legíveis por qualquer um, mas só root escreve.
const ROOT_ONLY_FIELDS: &[&str] = &["backlight_timeout", "boot_animation_sound", "lcd_override"];

fn read_field(field: &str) -> Option<String> {
    if GROUP_FIELDS.contains(&field) {
        sg::read_file(&path(field))
    } else {
        fs::read_to_string(path(field)).ok().map(|s| s.trim().to_string())
    }
}

fn toggle(id: &str, label: &str, description: &str, requires_root: bool) -> ToggleFeature {
    match read_field(id).as_deref() {
        Some("-1") | None => ToggleFeature {
            id: id.to_string(),
            label: label.to_string(),
            description: description.to_string(),
            supported: false,
            enabled: false,
            requires_root,
        },
        Some("0") => ToggleFeature {
            id: id.to_string(),
            label: label.to_string(),
            description: description.to_string(),
            supported: true,
            enabled: false,
            requires_root,
        },
        Some(_) => ToggleFeature {
            id: id.to_string(),
            label: label.to_string(),
            description: description.to_string(),
            supported: true,
            enabled: true,
            requires_root,
        },
    }
}

pub fn read() -> ExtrasReading {
    let battery_calibration = toggle(
        "battery_calibration",
        "Calibração de bateria",
        "Executa um ciclo completo de carga até 100%, descarga até 0% e recarga, para corrigir a leitura de percentual. Não desconecte da tomada durante o processo.",
        false,
    );
    let backlight_timeout = toggle(
        "backlight_timeout",
        "Apagar luz do teclado com inatividade",
        "Desliga a luz de fundo do teclado após 30 segundos sem uso.",
        true,
    );
    let boot_animation_sound = toggle(
        "boot_animation_sound",
        "Som e animação de boot",
        "Logo animado e som personalizados na inicialização.",
        true,
    );
    let lcd_override = toggle(
        "lcd_override",
        "LCD Override",
        "Reduz latência e ghosting da tela.",
        true,
    );

    let usb_level = read_field("usb_charging").and_then(|s| s.parse::<u8>().ok());
    let usb_charging = UsbChargingFeature {
        supported: matches!(usb_level, Some(0 | 10 | 20 | 30)),
        level: usb_level.unwrap_or(0),
    };

    ExtrasReading {
        meta: ProviderMeta::new(ProviderStatus::ReadOnly, "linuwu_sense nitro_sense"),
        battery_calibration,
        backlight_timeout,
        boot_animation_sound,
        lcd_override,
        usb_charging,
    }
}

fn require_model() -> Result<(), String> {
    if !model::is_confirmed() {
        return Err(format!(
            "Modelo de notebook não confirmado ({} necessário).",
            model::CONFIRMED_MODEL
        ));
    }
    Ok(())
}

/// Liga/desliga `battery_calibration`, `battery_limiter` ou `usb_charging`
/// (grupo `linuwu_sense`, sem precisar de root).
pub fn set_group_toggle(field: &str, enabled: bool) -> Result<(), String> {
    require_model()?;
    if !GROUP_FIELDS.contains(&field) {
        return Err(format!("Campo '{field}' não é um toggle de grupo conhecido."));
    }
    sg::write_file(&path(field), if enabled { "1" } else { "0" })
}

pub fn set_usb_charging(level: u8) -> Result<(), String> {
    require_model()?;
    if ![0, 10, 20, 30].contains(&level) {
        return Err("Valor inválido (use 0, 10, 20 ou 30).".to_string());
    }
    sg::write_file(&path("usb_charging"), &level.to_string())
}

/// Liga/desliga `backlight_timeout`, `boot_animation_sound` ou
/// `lcd_override` (root:root — precisa de root de verdade via pkexec).
pub fn set_root_toggle(field: &str, enabled: bool) -> Result<(), String> {
    require_model()?;
    if !ROOT_ONLY_FIELDS.contains(&field) {
        return Err(format!("Campo '{field}' não é um toggle root conhecido."));
    }
    let value = if enabled { "1" } else { "0" };
    let script = format!("echo '{value}' > '{}'", path(field));
    let output = std::process::Command::new("pkexec")
        .arg("bash")
        .arg("-c")
        .arg(&script)
        .output()
        .map_err(|e| format!("Falha ao executar pkexec: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "Escrita falhou: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}
