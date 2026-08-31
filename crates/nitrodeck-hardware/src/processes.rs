use nitrodeck_core::{ProcessEntry, ProcessesReading, ProviderMeta, ProviderStatus};
use std::fs;
use std::process::Command;

fn current_uid() -> Option<u32> {
    let status = fs::read_to_string("/proc/self/status").ok()?;
    for line in status.lines() {
        if let Some(rest) = line.strip_prefix("Uid:") {
            return rest.split_whitespace().next()?.parse().ok();
        }
    }
    None
}

/// Lista os processos mais pesados (CPU/memória) via `ps`, somente leitura.
/// Nunca escala privilégio: só mostra o que o próprio usuário já pode ver.
pub fn read() -> ProcessesReading {
    let my_uid = current_uid();
    let my_pid = std::process::id();

    let output = Command::new("ps")
        .args(["-eo", "pid,uid,pcpu,pmem,rss,comm", "--no-headers", "--sort=-pcpu"])
        .output();

    let Ok(output) = output else {
        return ProcessesReading {
            meta: ProviderMeta::new(ProviderStatus::Error, "ps")
                .with_detail("Não foi possível listar processos (comando ps falhou)."),
            processes: Vec::new(),
        };
    };
    if !output.status.success() {
        return ProcessesReading {
            meta: ProviderMeta::new(ProviderStatus::Error, "ps")
                .with_detail("ps retornou um erro ao listar processos."),
            processes: Vec::new(),
        };
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut processes: Vec<ProcessEntry> = text
        .lines()
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            let pid: u32 = parts.next()?.parse().ok()?;
            if pid == my_pid {
                return None;
            }
            let uid: u32 = parts.next()?.parse().ok()?;
            let cpu_percent: f64 = parts.next()?.parse().ok()?;
            let mem_percent: f64 = parts.next()?.parse().ok()?;
            let rss_kb: f64 = parts.next()?.parse().ok()?;
            let name: String = parts.collect::<Vec<_>>().join(" ");
            if name.is_empty() {
                return None;
            }
            Some(ProcessEntry {
                pid,
                name,
                cpu_percent,
                mem_percent,
                mem_mb: rss_kb / 1024.0,
                owned_by_user: my_uid == Some(uid),
            })
        })
        .filter(|p| p.cpu_percent > 0.05 || p.mem_mb > 5.0)
        .collect();

    processes.truncate(40);

    ProcessesReading {
        meta: ProviderMeta::new(ProviderStatus::ReadOnly, "ps -eo pid,uid,pcpu,pmem,rss,comm"),
        processes,
    }
}

/// Encerra (SIGTERM) um processo — só se ele pertencer ao usuário atual.
/// Nunca usa pkexec/root aqui: matar processo de outro usuário ou do
/// sistema fica fora do escopo por segurança.
pub fn kill(pid: u32) -> Result<(), String> {
    let my_uid = current_uid();
    let status = fs::read_to_string(format!("/proc/{pid}/status"))
        .map_err(|_| "Processo não encontrado (já pode ter encerrado sozinho).".to_string())?;
    let owner_uid: Option<u32> = status
        .lines()
        .find_map(|l| l.strip_prefix("Uid:")?.split_whitespace().next()?.parse().ok());

    if owner_uid != my_uid {
        return Err(
            "Esse processo não pertence ao seu usuário — o NitroDeck não encerra processos de outros usuários ou do sistema.".to_string(),
        );
    }

    let output = Command::new("kill")
        .arg("-TERM")
        .arg(pid.to_string())
        .output()
        .map_err(|e| format!("Falha ao executar kill: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "Falha ao encerrar processo: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}
