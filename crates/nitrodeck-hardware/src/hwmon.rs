use std::fs;
use std::path::PathBuf;

pub struct HwmonChip {
    pub path: PathBuf,
    pub name: String,
}

/// Enumera os chips em /sys/class/hwmon (somente leitura, sem privilégio).
pub fn chips() -> Vec<HwmonChip> {
    let mut out = Vec::new();
    let Ok(entries) = fs::read_dir("/sys/class/hwmon") else {
        return out;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if let Ok(name) = fs::read_to_string(path.join("name")) {
            out.push(HwmonChip {
                path,
                name: name.trim().to_string(),
            });
        }
    }
    out
}

pub fn read_u64(path: &std::path::Path) -> Option<u64> {
    fs::read_to_string(path).ok()?.trim().parse().ok()
}
