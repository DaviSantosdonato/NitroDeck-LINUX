use nitrodeck_core::{KeyboardLightingReading, ProviderMeta, ProviderStatus};
use std::fs;

pub fn read() -> KeyboardLightingReading {
    let has_rgb_control = fs::read_dir("/sys/class/leds")
        .map(|entries| {
            entries.flatten().any(|e| {
                let name = e.file_name().to_string_lossy().to_lowercase();
                (name.contains("kbd") || name.contains("keyboard")) && name.contains("multicolor")
            })
        })
        .unwrap_or(false);

    let status = if has_rgb_control {
        ProviderStatus::AwaitingValidation
    } else {
        ProviderStatus::Unavailable
    };

    let mut meta = ProviderMeta::new(status, "/sys/class/leds");
    if !has_rgb_control {
        meta = meta.with_detail(
            "Nenhuma interface de controle RGB padrão foi encontrada para este teclado.",
        );
    }

    KeyboardLightingReading { meta }
}
