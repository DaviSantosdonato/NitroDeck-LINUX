//! Confirma o modelo exato do notebook antes de permitir qualquer escrita
//! via WMI (ventoinha, bateria, extras). Nunca reescreva isso para "aceitar
//! qualquer modelo" sem validar de novo em hardware real — os métodos WMI
//! variam por modelo e nunca foram testados fora do Nitro ANV15-52.

use std::fs;

pub const CONFIRMED_MODEL: &str = "Nitro ANV15-52";

pub fn is_confirmed() -> bool {
    product_name()
        .map(|s| s == CONFIRMED_MODEL)
        .unwrap_or(false)
}

pub fn vendor() -> Option<String> {
    fs::read_to_string("/sys/class/dmi/id/sys_vendor")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

pub fn product_name() -> Option<String> {
    fs::read_to_string("/sys/class/dmi/id/product_name")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

pub fn linuwu_sense_present() -> bool {
    std::path::Path::new("/sys/module/linuwu_sense").exists()
}

fn consent_path() -> Option<std::path::PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(std::path::PathBuf::from(home).join(".config/nitrodeck/hardware-risk-accepted"))
}

/// A pessoa já confirmou explicitamente que quer usar os controles de
/// hardware num modelo que não é o validado. Isso é uma decisão dela, feita
/// com um aviso claro na tela — nunca o padrão automático.
pub fn risk_accepted() -> bool {
    consent_path().map(|p| p.exists()).unwrap_or(false)
}

pub fn accept_risk() -> Result<(), String> {
    let path = consent_path().ok_or_else(|| "Não foi possível localizar o diretório do usuário (HOME).".to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Falha ao criar diretório de config: {e}"))?;
    }
    let content = product_name().unwrap_or_else(|| "desconhecido".to_string());
    fs::write(&path, content).map_err(|e| format!("Falha ao salvar consentimento: {e}"))
}

pub fn revoke_risk() -> Result<(), String> {
    if let Some(path) = consent_path() {
        let _ = fs::remove_file(path);
    }
    Ok(())
}

/// Libera escrita real de hardware: ou o modelo bate exatamente com o
/// confirmado, ou a pessoa aceitou explicitamente o risco de um modelo não
/// validado (`accept_risk`). Nunca liberamos por padrão.
pub fn controls_allowed() -> bool {
    is_confirmed() || risk_accepted()
}
