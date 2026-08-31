//! Leitura/escrita de arquivos do grupo `linuwu_sense` sem exigir root.
//!
//! O processo do NitroDeck normalmente não carrega o grupo suplementar
//! `linuwu_sense` (só pega isso num novo login), então uma leitura/escrita
//! direta em `fs::` erraria com "Permission denied" mesmo com o driver
//! funcionando. `sg` assume o grupo só para o comando filho, sem escalar
//! privilégio — é o mesmo grupo que o usuário já tem em `/etc/group`.

use std::process::Command;

pub fn read_file(path: &str) -> Option<String> {
    let output = Command::new("sg")
        .arg("linuwu_sense")
        .arg("-c")
        .arg(format!("cat '{path}'"))
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub fn write_file(path: &str, value: &str) -> Result<(), String> {
    let script = format!("echo '{value}' > '{path}'");
    let output = Command::new("sg")
        .arg("linuwu_sense")
        .arg("-c")
        .arg(&script)
        .output()
        .map_err(|e| format!("Falha ao executar sg: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "Escrita falhou: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}
