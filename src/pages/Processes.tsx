import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, Rocket } from "lucide-react";
import type { HardwareSnapshot } from "../types/hardware";
import { Card, CardHeader } from "../components/Card";
import { StatusPill } from "../components/StatusPill";
import { ProcessTable } from "../components/ProcessTable";

export function ProcessesPage({ snap }: { snap: HardwareSnapshot }) {
  const { processes } = snap;

  return (
    <div className="space-y-5">
      <LaunchWithLimits gpuAvailable={snap.gpuDiscrete.meta.status === "read-only"} />

      <Card>
        <CardHeader
          title="Processos"
          subtitle={`fonte: ${processes.meta.source} · encerrar e limitar memória só nos processos do seu próprio usuário (cgroups, sem root)`}
          right={<StatusPill status={processes.meta.status} />}
        />
        <ProcessTable processes={processes.processes} />
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
