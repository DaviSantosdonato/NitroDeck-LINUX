use crate::sg;
use nitrodeck_core::{BatteryReading, BatteryStatus, ProviderMeta, ProviderStatus};
use std::fs;
use std::path::{Path, PathBuf};

const LINUWU_BATTERY_LIMITER: &str =
    "/sys/module/linuwu_sense/drivers/platform:acer-wmi/acer-wmi/nitro_sense/battery_limiter";

fn find_battery_dir() -> Option<PathBuf> {
    let entries = fs::read_dir("/sys/class/power_supply").ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        let ptype = fs::read_to_string(path.join("type")).unwrap_or_default();
        if ptype.trim() == "Battery" {
            return Some(path);
        }
    }
    None
}

fn read_str(dir: &Path, file: &str) -> Option<String> {
    fs::read_to_string(dir.join(file))
        .ok()
        .map(|s| s.trim().to_string())
}

fn read_num(dir: &Path, file: &str) -> Option<f64> {
    read_str(dir, file)?.parse().ok()
}

fn charge_limit_via_standard_sysfs(dir: &Path) -> bool {
    const CANDIDATES: &[&str] = &[
        "charge_control_end_threshold",
        "charge_stop_threshold",
        "charge_control_start_threshold",
    ];
    CANDIDATES.iter().any(|f| dir.join(f).exists())
}

/// (suportado, ligado) — tenta o linuwu_sense primeiro (é o que funciona
/// neste hardware); nenhuma bateria padrão deste notebook expõe os
/// arquivos sysfs de limite de carga.
fn charge_limit_state(dir: &Path) -> (bool, Option<bool>) {
    match sg::read_file(LINUWU_BATTERY_LIMITER).as_deref() {
        Some("0") => return (true, Some(false)),
        Some("1") => return (true, Some(true)),
        _ => {}
    }
    (charge_limit_via_standard_sysfs(dir), None)
}

pub fn read() -> BatteryReading {
    let Some(dir) = find_battery_dir() else {
        return BatteryReading {
            meta: ProviderMeta::new(ProviderStatus::Unavailable, "/sys/class/power_supply")
                .with_detail("Nenhuma bateria encontrada em /sys/class/power_supply."),
            percent: 0.0,
            status: BatteryStatus::NotCharging,
            cycle_count: None,
            health_pct: None,
            power_now_w: None,
            time_remaining_min: None,
            charge_limit_supported: false,
            charge_limit_enabled: None,
        };
    };

    let percent = read_num(&dir, "capacity").unwrap_or(0.0);

    let status = match read_str(&dir, "status").as_deref() {
        Some("Charging") => BatteryStatus::Charging,
        Some("Full") => BatteryStatus::Full,
        Some("Discharging") => BatteryStatus::Discharging,
        _ => BatteryStatus::NotCharging,
    };

    let cycle_count = read_num(&dir, "cycle_count").map(|v| v as u32);

    // Algumas baterias reportam em charge_* (µAh), outras em energy_* (µWh).
    let health_pct = match (
        read_num(&dir, "charge_full"),
        read_num(&dir, "charge_full_design"),
    ) {
        (Some(full), Some(design)) if design > 0.0 => Some((full / design) * 100.0),
        _ => match (
            read_num(&dir, "energy_full"),
            read_num(&dir, "energy_full_design"),
        ) {
            (Some(full), Some(design)) if design > 0.0 => Some((full / design) * 100.0),
            _ => None,
        },
    };

    let power_now_w = match read_num(&dir, "power_now") {
        Some(uw) => Some(uw / 1_000_000.0),
        None => match (read_num(&dir, "current_now"), read_num(&dir, "voltage_now")) {
            (Some(ua), Some(uv)) => Some((ua * uv) / 1_000_000_000_000.0),
            _ => None,
        },
    };

    let time_remaining_min = match (power_now_w, status) {
        (Some(power_w), BatteryStatus::Discharging) if power_w > 0.05 => {
            let remaining_wh = match (
                read_num(&dir, "energy_now"),
                read_num(&dir, "charge_now"),
                read_num(&dir, "voltage_now"),
            ) {
                (Some(uwh), _, _) => Some(uwh / 1_000_000.0),
                (None, Some(uah), Some(uv)) => Some((uah * uv) / 1_000_000_000_000.0),
                _ => None,
            };
            remaining_wh.map(|wh| (wh / power_w) * 60.0)
        }
        _ => None,
    };

    let (charge_limit_supported, charge_limit_enabled) = charge_limit_state(&dir);

    BatteryReading {
        meta: ProviderMeta::new(ProviderStatus::Ok, "/sys/class/power_supply/BAT*"),
        percent,
        status,
        cycle_count,
        health_pct,
        power_now_w,
        time_remaining_min,
        charge_limit_supported,
        charge_limit_enabled,
    }
}

pub fn set_charge_limit(enabled: bool) -> Result<(), String> {
    crate::extras::set_group_toggle("battery_limiter", enabled)
}
