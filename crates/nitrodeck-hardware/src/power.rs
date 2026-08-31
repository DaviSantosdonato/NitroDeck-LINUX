use nitrodeck_core::{PowerProfile, PowerReading, ProviderMeta, ProviderStatus};
use std::process::Command;

const PROFILES: &[(&str, &str)] = &[
    ("power-saver", "Economia de energia"),
    ("balanced", "Equilibrado"),
    ("performance", "Desempenho"),
];

pub fn read() -> PowerReading {
    let active = Command::new("powerprofilesctl")
        .arg("get")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

    match active {
        Some(active_id) => {
            let profiles = PROFILES
                .iter()
                .map(|(id, label)| PowerProfile {
                    id: id.to_string(),
                    label: label.to_string(),
                    active: *id == active_id,
                })
                .collect();
            PowerReading {
                meta: ProviderMeta::new(ProviderStatus::Ok, "powerprofilesctl get"),
                profiles,
            }
        }
        None => PowerReading {
            meta: ProviderMeta::new(ProviderStatus::Unavailable, "powerprofilesctl")
                .with_detail("power-profiles-daemon não respondeu — não é possível ler nem trocar o perfil."),
            profiles: Vec::new(),
        },
    }
}

/// Troca o perfil de energia via power-profiles-daemon (D-Bus/polkit próprio
/// dele, sem precisar de pkexec aqui). Isso troca o governor da CPU
/// (intel_pstate) de verdade; a parte específica de plataforma do Acer
/// (WMI/EC) tem um bug conhecido neste modelo e fica de fora por enquanto.
pub fn set_profile(id: &str) -> Result<(), String> {
    if !PROFILES.iter().any(|(pid, _)| *pid == id) {
        return Err(format!("Perfil de energia inválido: {id}"));
    }
    let output = Command::new("powerprofilesctl")
        .arg("set")
        .arg(id)
        .output()
        .map_err(|e| format!("Falha ao executar powerprofilesctl: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "Falha ao trocar perfil: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}
