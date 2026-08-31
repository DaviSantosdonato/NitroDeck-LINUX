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

/// Cgroup delegado à sessão do usuário (o mesmo que `systemd-run --user
/// --scope` usa por baixo) — dá pra criar subgrupos e mover processos pra
/// dentro sem pkexec/root, porque o systemd já delega isso ao dono da
/// sessão.
fn app_slice_path() -> Option<String> {
    let uid = current_uid()?;
    Some(format!(
        "/sys/fs/cgroup/user.slice/user-{uid}.slice/user@{uid}.service/app.slice"
    ))
}

fn limit_cgroup_path(pid: u32) -> Option<String> {
    Some(format!("{}/nitrodeck-limit-{pid}", app_slice_path()?))
}

fn read_memory_limit_mb(pid: u32) -> Option<u32> {
    let path = limit_cgroup_path(pid)?;
    let raw = fs::read_to_string(format!("{path}/memory.max")).ok()?;
    let raw = raw.trim();
    if raw == "max" {
        return None;
    }
    let bytes: u64 = raw.parse().ok()?;
    Some((bytes / (1024 * 1024)) as u32)
}

fn owner_uid(pid: u32) -> Option<u32> {
    let status = fs::read_to_string(format!("/proc/{pid}/status")).ok()?;
    status
        .lines()
        .find_map(|l| l.strip_prefix("Uid:")?.split_whitespace().next()?.parse().ok())
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
            let owned_by_user = my_uid == Some(uid);
            Some(ProcessEntry {
                pid,
                name,
                cpu_percent,
                mem_percent,
                mem_mb: rss_kb / 1024.0,
                owned_by_user,
                memory_limit_mb: if owned_by_user { read_memory_limit_mb(pid) } else { None },
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
    if owner_uid(pid).is_none() {
        return Err("Processo não encontrado (já pode ter encerrado sozinho).".to_string());
    }
    if owner_uid(pid) != current_uid() {
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

/// Aplica (ou remove, com `memory_mb: None`) um teto de memória num
/// processo que já está rodando, movendo-o pra um cgroup próprio. Só age
/// em processos do próprio usuário — nunca escala privilégio, usa a mesma
/// delegação de cgroup que `systemd-run --user --scope` já usa.
pub fn set_memory_limit(pid: u32, memory_mb: Option<u32>) -> Result<(), String> {
    if owner_uid(pid).is_none() {
        return Err("Processo não encontrado (já pode ter encerrado sozinho).".to_string());
    }
    if owner_uid(pid) != current_uid() {
        return Err(
            "Esse processo não pertence ao seu usuário — o NitroDeck não limita processos de outros usuários ou do sistema.".to_string(),
        );
    }
    if let Some(mb) = memory_mb {
        if mb == 0 {
            return Err("Limite de memória precisa ser maior que 0.".to_string());
        }
    }

    let base = app_slice_path().ok_or_else(|| "Não foi possível localizar o cgroup da sessão.".to_string())?;
    let cgroup = limit_cgroup_path(pid).ok_or_else(|| "Não foi possível montar o caminho do cgroup.".to_string())?;

    match memory_mb {
        Some(mb) => {
            fs::create_dir_all(&cgroup).map_err(|e| format!("Falha ao criar cgroup: {e}"))?;
            fs::write(format!("{cgroup}/memory.max"), (mb as u64 * 1024 * 1024).to_string())
                .map_err(|e| format!("Falha ao definir limite de memória: {e}"))?;
            fs::write(format!("{cgroup}/cgroup.procs"), pid.to_string())
                .map_err(|e| format!("Falha ao mover processo pro cgroup limitado (pode já ter encerrado): {e}"))?;
        }
        None => {
            // Devolve o processo pro cgroup pai (sem limite) e remove o subgrupo vazio.
            let _ = fs::write(format!("{base}/cgroup.procs"), pid.to_string());
            let _ = fs::remove_dir(&cgroup);
        }
    }
    Ok(())
}
