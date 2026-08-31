import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, Rocket, X } from "lucide-react";
import type { HardwareSnapshot } from "../types/hardware";
import { Card, CardHeader } from "../components/Card";
import { StatusPill } from "../components/StatusPill";

export function ProcessesPage({ snap }: { snap: HardwareSnapshot }) {
  const { processes } = snap;
  const [killing, setKilling] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function kill(pid: number) {
    setKilling(pid);
    setError(null);
    try {
      await invoke("kill_process", { pid });
    } catch (err) {
      setError(String(err));
    } finally {
      setKilling(null);
    }
  }

  return (
    <div className="space-y-5">
      <LaunchWithLimits gpuAvailable={snap.gpuDiscrete.meta.status === "read-only"} />

      <Card>
        <CardHeader
          title="Processos"
          subtitle={`fonte: ${processes.meta.source} · só é possível encerrar processos do seu próprio usuário`}
          right={<StatusPill status={processes.meta.status} />}
        />

        {error && (
          <div
            className="mb-4 flex items-center gap-2 text-xs rounded-lg px-3 py-2"
            style={{ background: "rgba(248,113,113,0.12)", color: "var(--bad)" }}
          >
            <AlertTriangle size={13} />
            {error}
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
              {processes.processes.map((p) => (
                <tr key={p.pid} className="border-t border-[var(--border-1)]">
                  <td className="py-2 pr-3 text-[var(--text-0)] truncate max-w-[240px]">{p.name}</td>
                  <td className="py-2 pr-3 text-right text-[var(--text-2)] tabular">{p.pid}</td>
                  <td className="py-2 pr-3 text-right tabular">{p.cpuPercent.toFixed(1)}%</td>
                  <td className="py-2 pr-3 text-right tabular">{p.memMb.toFixed(0)} MB</td>
                  <td className="py-2 text-right">
                    {p.ownedByUser ? (
                      <button
                        onClick={() => kill(p.pid)}
                        disabled={killing === p.pid}
                        title="Encerrar processo (SIGTERM)"
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg disabled:opacity-50 hover:bg-[var(--bg-3)]"
                        style={{ color: "var(--bad)" }}
                      >
                        <X size={12} />
                        {killing === p.pid ? "..." : "Encerrar"}
                      </button>
                    ) : (
                      <span className="text-[10px] text-[var(--text-2)]">sistema</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {processes.processes.length === 0 && (
          <p className="text-xs text-[var(--text-2)] py-4">
            {processes.meta.detail ?? "Nenhum processo relevante no momento."}
          </p>
        )}
      </Card>
    </div>
  );
}

function LaunchWithLimits({ gpuAvailable }: { gpuAvailable: boolean }) {
  const [command, setCommand] = useState("");
  const [memoryMb, setMemoryMb] = useState("");
  const [cpuPercent, setCpuPercent] = useState("");
  const [gpu, setGpu] = useState<"integrated" | "dedicated">("integrated");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function launch() {
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      await invoke("launch_with_limits", {
        command,
        memoryMb: memoryMb ? Number(memoryMb) : null,
        cpuPercent: cpuPercent ? Number(cpuPercent) : null,
        gpu: gpu === "dedicated" ? "dedicated" : null,
      });
      setOk(true);
      setCommand("");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  const canLaunch = command.trim().length > 0 && (memoryMb || cpuPercent || gpu === "dedicated") && !busy;

  return (
    <Card>
      <CardHeader
        title="Abrir programa com limite / GPU"
        subtitle="Roda num escopo systemd (cgroups) — teto e GPU valem só pra esse programa, sem privilégio de root"
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] text-[var(--text-2)] block mb-1">Comando</label>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="ex: firefox, code ~/projeto, blender"
            className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-2)] border border-[var(--border-1)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="w-32">
          <label className="text-[11px] text-[var(--text-2)] block mb-1">Memória (MB)</label>
          <input
            type="number"
            min={1}
            value={memoryMb}
            onChange={(e) => setMemoryMb(e.target.value)}
            placeholder="ex: 4096"
            className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-2)] border border-[var(--border-1)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="w-28">
          <label className="text-[11px] text-[var(--text-2)] block mb-1">CPU (%)</label>
          <input
            type="number"
            min={1}
            max={cpuMaxPercent()}
            value={cpuPercent}
            onChange={(e) => setCpuPercent(e.target.value)}
            placeholder="ex: 50"
            className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-2)] border border-[var(--border-1)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        {gpuAvailable && (
          <div className="w-36">
            <label className="text-[11px] text-[var(--text-2)] block mb-1">GPU</label>
            <select
              value={gpu}
              onChange={(e) => setGpu(e.target.value as "integrated" | "dedicated")}
              className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-2)] border border-[var(--border-1)] outline-none focus:border-[var(--accent)]"
            >
              <option value="integrated">Integrada (padrão)</option>
              <option value="dedicated">Dedicada (RTX)</option>
            </select>
          </div>
        )}
        <button
          onClick={launch}
          disabled={!canLaunch}
          className="shrink-0 inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <Rocket size={14} />
          {busy ? "Abrindo..." : "Abrir"}
        </button>
      </div>
      {gpuAvailable ? (
        <p className="mt-2 text-[11px] text-[var(--text-2)]">
          "Dedicada" usa PRIME render offload — só esse programa roda na RTX, o resto do sistema continua na Intel
          (não troca a GPU da sessão inteira, sem precisar reiniciar).
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-[var(--text-2)]">
          GPU dedicada não disponível para escolher ainda (driver não carregado ou não reconhecido).
        </p>
      )}
      {error && (
        <div
          className="mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2"
          style={{ background: "rgba(248,113,113,0.12)", color: "var(--bad)" }}
        >
          <AlertTriangle size={13} />
          {error}
        </div>
      )}
      {ok && !error && (
        <p className="mt-3 text-xs" style={{ color: "var(--good)" }}>
          Programa iniciado com o limite definido.
        </p>
      )}
    </Card>
  );
}

function cpuMaxPercent(): number {
  return Math.max(100, (navigator.hardwareConcurrency || 1) * 100);
}
