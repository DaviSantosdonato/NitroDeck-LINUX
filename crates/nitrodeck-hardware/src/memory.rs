use nitrodeck_core::{MemoryReading, ProviderMeta, ProviderStatus};
use std::collections::HashMap;
use std::fs;

fn parse_meminfo() -> Option<HashMap<String, u64>> {
    let content = fs::read_to_string("/proc/meminfo").ok()?;
    let mut map = HashMap::new();
    for line in content.lines() {
        let mut parts = line.splitn(2, ':');
        let key = parts.next()?.trim().to_string();
        let rest = parts.next()?.trim();
        let value_kb: u64 = rest.split_whitespace().next()?.parse().ok()?;
        map.insert(key, value_kb);
    }
    Some(map)
}

pub fn read() -> MemoryReading {
    let info = parse_meminfo();

    let (total_mb, used_mb, swap_total_mb, swap_used_mb, status) = match &info {
        Some(m) => {
            let total_kb = *m.get("MemTotal").unwrap_or(&0) as f64;
            let available_kb = *m.get("MemAvailable").unwrap_or(&0) as f64;
            let swap_total_kb = *m.get("SwapTotal").unwrap_or(&0) as f64;
            let swap_free_kb = *m.get("SwapFree").unwrap_or(&0) as f64;
            (
                total_kb / 1024.0,
                (total_kb - available_kb).max(0.0) / 1024.0,
                swap_total_kb / 1024.0,
                (swap_total_kb - swap_free_kb).max(0.0) / 1024.0,
                ProviderStatus::Ok,
            )
        }
        None => (0.0, 0.0, 0.0, 0.0, ProviderStatus::Error),
    };

    MemoryReading {
        meta: ProviderMeta::new(status, "/proc/meminfo"),
        total_mb,
        used_mb,
        swap_total_mb,
        swap_used_mb,
    }
}
