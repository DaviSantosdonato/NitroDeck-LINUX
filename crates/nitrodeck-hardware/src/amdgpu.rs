//! Telemetria real de GPU AMD via sysfs — interface documentada e estável
//! do driver `amdgpu` (Documentation/gpu/amdgpu no kernel), nada de
//! ferramenta de terceiros nem parsing de saída de comando. Mesma filosofia
//! do `nvml.rs`: sem essa leitura, uma GPU AMD aparecia só identificada,
//! sem nenhum número real.

use std::fs;
use std::path::PathBuf;

pub struct AmdgpuReading {
    pub gpu_util_pct: Option<f64>,
    pub vram_used_mb: Option<f64>,
    pub vram_total_mb: Option<f64>,
    pub temp_c: Option<f64>,
    pub power_w: Option<f64>,
}

fn find_amdgpu_device_dir() -> Option<PathBuf> {
    let entries = fs::read_dir("/sys/class/drm").ok()?;
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        // só os diretórios "cardN" de verdade, não as saídas "cardN-HDMI-..."
        if !name.starts_with("card") || name.contains('-') {
            continue;
        }
        let device_dir = entry.path().join("device");
        let uevent = fs::read_to_string(device_dir.join("uevent")).unwrap_or_default();
        if uevent.lines().any(|l| l == "DRIVER=amdgpu") {
            return Some(device_dir);
        }
    }
    None
}

fn read_u64(path: &std::path::Path) -> Option<u64> {
    fs::read_to_string(path).ok()?.trim().parse().ok()
}

fn find_hwmon_dir(device_dir: &std::path::Path) -> Option<PathBuf> {
    let entries = fs::read_dir(device_dir.join("hwmon")).ok()?;
    entries.flatten().next().map(|e| e.path())
}

pub fn read() -> Option<AmdgpuReading> {
    let device_dir = find_amdgpu_device_dir()?;

    let gpu_util_pct = read_u64(&device_dir.join("gpu_busy_percent")).map(|v| v as f64);
    let vram_used_mb = read_u64(&device_dir.join("mem_info_vram_used")).map(|b| b as f64 / (1024.0 * 1024.0));
    let vram_total_mb = read_u64(&device_dir.join("mem_info_vram_total")).map(|b| b as f64 / (1024.0 * 1024.0));

    let (temp_c, power_w) = match find_hwmon_dir(&device_dir) {
        Some(hwmon) => {
            let temp = read_u64(&hwmon.join("temp1_input")).map(|v| v as f64 / 1000.0);
            let power = read_u64(&hwmon.join("power1_average"))
                .or_else(|| read_u64(&hwmon.join("power1_input")))
                .map(|v| v as f64 / 1_000_000.0);
            (temp, power)
        }
        None => (None, None),
    };

    if gpu_util_pct.is_none() && vram_used_mb.is_none() && temp_c.is_none() && power_w.is_none() {
        return None;
    }

    Some(AmdgpuReading {
        gpu_util_pct,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        power_w,
    })
}
