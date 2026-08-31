import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, Gauge, X } from "lucide-react";
import type { ProcessEntry } from "../types/hardware";

/**
 * Tabela de processos com ação de encerrar e limitar memória (cgroups, sem
 * root, só nos processos do próprio usuário). Reutilizada tanto em
 * Processos quanto em Memória — mesma lógica, sem duplicar.
 */
export function ProcessTable({ processes }: { processes: ProcessEntry[] }) {
  const [killing, setKilling] = useState<number | null>(null);
  const [killError, setKillError] = useState<string | null>(null);

  async function kill(pid: number) {
    setKilling(pid);
    setKillError(null);
    try {
      await invoke("kill_process", { pid });
    } catch (err) {
      setKillError(String(err));
    } finally {
      setKilling(null);
    }
  }

  return (
    <div>
      {killError && (
        <div
          className="mb-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2"
          style={{ background: "rgba(248,113,113,0.12)", color: "var(--bad)" }}
        >
          <AlertTriangle size={13} />
          {killError}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-[var(--text-2)] uppercase tracking-wide">
              <th className="pb-2 font-medium">Processo</th>
              <th className="pb-2 font-medium text-right">PID</th>
              <th className="pb-2 font-medium text-right">CPU</th>
              <th className="pb-2 font-medium text-right">Memória</th>
              <th className="pb-2 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody>
            {processes.map((p) => (
              <ProcessRow key={p.pid} process={p} killing={killing === p.pid} onKill={() => kill(p.pid)} />
            ))}
          </tbody>
        </table>
      </div>
      {processes.length === 0 && (
        <p className="text-xs text-[var(--text-2)] py-4">Nenhum processo relevante no momento.</p>
      )}
    </div>
  );
}

function ProcessRow({
  process,
  killing,
  onKill,
}: {
  process: ProcessEntry;
  killing: boolean;
  onKill: () => void;
}) {
  const [showLimitInput, setShowLimitInput] = useState(false);
  const [limitValue, setLimitValue] = useState(process.memoryLimitMb ?? Math.ceil(process.memMb));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function applyLimit() {
    setBusy(true);
    setError(null);
    try {
      await invoke("set_process_memory_limit", { pid: process.pid, memoryMb: limitValue });
      setShowLimitInput(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeLimit() {
    setBusy(true);
    setError(null);
    try {
      await invoke("set_process_memory_limit", { pid: process.pid, memoryMb: null });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-[var(--border-1)] align-top">
      <td className="py-2 pr-3 text-[var(--text-0)] truncate max-w-[240px]">{process.name}</td>
      <td className="py-2 pr-3 text-right text-[var(--text-2)] tabular">{process.pid}</td>
      <td className="py-2 pr-3 text-right tabular">{process.cpuPercent.toFixed(1)}%</td>
      <td className="py-2 pr-3 text-right tabular">
        {process.memMb.toFixed(0)} MB
        {process.memoryLimitMb !== null && (
          <div className="text-[10px]" style={{ color: "var(--accent)" }}>
            limite {process.memoryLimitMb} MB
          </div>
        )}
      </td>
      <td className="py-2 text-right">
        {process.ownedByUser ? (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              {process.memoryLimitMb !== null ? (
                <button
                  onClick={removeLimit}
                  disabled={busy}
                  title="Remover limite de memória"
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg disabled:opacity-50 hover:bg-[var(--bg-3)]"
                  style={{ color: "var(--accent)" }}
                >
                  <Gauge size={12} />
                  Tirar limite
                </button>
              ) : (
                <button
                  onClick={() => setShowLimitInput((v) => !v)}
                  disabled={busy}
                  title="Limitar memória deste processo"
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg disabled:opacity-50 hover:bg-[var(--bg-3)]"
                  style={{ color: "var(--text-1)" }}
                >
                  <Gauge size={12} />
                  Limitar
                </button>
              )}
              <button
                onClick={onKill}
                disabled={killing}
                title="Encerrar processo (SIGTERM)"
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg disabled:opacity-50 hover:bg-[var(--bg-3)]"
                style={{ color: "var(--bad)" }}
              >
                <X size={12} />
                {killing ? "..." : "Encerrar"}
              </button>
            </div>
            {showLimitInput && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  value={limitValue}
                  onChange={(e) => setLimitValue(Number(e.target.value))}
                  className="w-20 rounded-lg px-2 py-1 text-xs bg-[var(--bg-2)] border border-[var(--border-1)] outline-none focus:border-[var(--accent)]"
                />
                <span className="text-[10px] text-[var(--text-2)]">MB</span>
                <button
                  onClick={applyLimit}
                  disabled={busy}
                  className="text-xs font-medium px-2 py-1 rounded-lg disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  OK
                </button>
              </div>
            )}
            {error && (
              <span className="text-[10px] max-w-[160px] text-right" style={{ color: "var(--bad)" }}>
                {error}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-[var(--text-2)]">sistema</span>
        )}
      </td>
    </tr>
  );
}
