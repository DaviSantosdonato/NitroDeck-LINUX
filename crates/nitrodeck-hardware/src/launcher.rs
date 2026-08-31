use std::process::{Command, Stdio};

/// Abre um programa dentro de um escopo systemd (`systemd-run --user --scope`)
/// com teto de memória e/ou CPU. Usa cgroups delegados à sessão do usuário —
/// não precisa de root nem de pkexec. O limite vale só para esse programa (e
/// seus filhos); o resto do sistema não é afetado. Se o processo passar do
/// teto de memória, o kernel mata só ele (OOM restrito ao escopo).
pub fn launch_with_limits(
    command: String,
    memory_mb: Option<u32>,
    cpu_percent: Option<u32>,
    gpu: Option<String>,
) -> Result<(), String> {
    let mut parts = command.split_whitespace();
    let program = parts
        .next()
        .ok_or_else(|| "Informe um comando ou caminho de programa.".to_string())?;
    let args: Vec<&str> = parts.collect();

    if memory_mb.is_none() && cpu_percent.is_none() && gpu.is_none() {
        return Err("Defina ao menos uma opção (memória, CPU ou GPU).".to_string());
    }
    if memory_mb == Some(0) {
        return Err("Limite de memória precisa ser maior que 0.".to_string());
    }
    if cpu_percent == Some(0) {
        return Err("Limite de CPU precisa ser maior que 0%.".to_string());
    }
    if let Some(g) = gpu.as_deref() {
        if g != "dedicated" {
            return Err(format!("GPU inválida: {g}"));
        }
    }

    let mut cmd = Command::new("systemd-run");
    cmd.arg("--user").arg("--scope").arg("--collect");
    cmd.arg("--unit").arg(format!(
        "nitrodeck-launch-{}",
        nitrodeck_core::now_ms()
    ));
    if let Some(mb) = memory_mb {
        cmd.arg("-p").arg(format!("MemoryMax={mb}M"));
    }
    if let Some(pct) = cpu_percent {
        cmd.arg("-p").arg(format!("CPUQuota={pct}%"));
    }
    if gpu.as_deref() == Some("dedicated") {
        // PRIME render offload: roda esse programa específico na GPU
        // dedicada, sem trocar a GPU da sessão inteira (que continua na
        // Intel) — é o jeito padrão e seguro de usar a dedicada num notebook
        // híbrido, sem precisar reiniciar a sessão gráfica.
        cmd.arg("--setenv=__NV_PRIME_RENDER_OFFLOAD=1");
        cmd.arg("--setenv=__NV_PRIME_RENDER_OFFLOAD_PROVIDER=NVIDIA-G0");
        cmd.arg("--setenv=__GLX_VENDOR_LIBRARY_NAME=nvidia");
        cmd.arg("--setenv=__VK_LAYER_NV_optimus=NVIDIA_only");
    }
    cmd.arg("--").arg(program).args(&args);
    cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());

    cmd.spawn()
        .map_err(|e| format!("Falha ao iniciar \"{program}\": {e}"))?;
    Ok(())
}
