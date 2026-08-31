import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, BatteryFull, Gauge, Rocket } from "lucide-react";
import type { HardwareSnapshot, PowerProfile } from "../types/hardware";
import { Card, CardHeader } from "../components/Card";
import { StatusPill } from "../components/StatusPill";
import clsx from "clsx";

const ICON: Record<PowerProfile["id"], typeof Gauge> = {
  "power-saver": BatteryFull,
  balanced: Gauge,
  performance: Rocket,
};

export function PowerPage({ snap }: { snap: HardwareSnapshot }) {
  const { power } = snap;
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function activate(id: string) {
    setPending(id);
    setError(null);
    try {
      await invoke("set_power_profile", { id });
    } catch (err) {
      setError(String(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Perfil de energia"
          subtitle={`fonte: ${power.meta.source} · troca real via power-profiles-daemon`}
          right={<StatusPill status={power.meta.status} />}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {power.profiles.map((p) => {
            const Icon = ICON[p.id];
            const busy = pending === p.id;
            return (
              <button
                key={p.id}
                onClick={() => activate(p.id)}
                disabled={pending !== null}
                className={clsx(
                  "rounded-xl p-4 flex flex-col items-center gap-2 text-center border transition-all disabled:opacity-60",
                  p.active ? "border-[var(--accent)]" : "border-[var(--border-1)] hover:border-[var(--text-2)]",
                )}
                style={p.active ? { background: "var(--accent-soft)" } : { background: "var(--bg-2)" }}
              >
                <Icon size={20} style={{ color: p.active ? "var(--accent)" : "var(--text-2)" }} />
                <span className="text-sm font-medium">{p.label}</span>
                {busy ? (
                  <span className="text-[10px] text-[var(--text-2)]">Aplicando...</span>
                ) : p.active ? (
                  <span className="text-[10px] font-medium" style={{ color: "var(--accent)" }}>
                    Ativo
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--text-2)]">Clique para ativar</span>
                )}
              </button>
            );
          })}
        </div>
        {power.profiles.length === 0 && (
          <p className="text-xs text-[var(--text-2)]">{power.meta.detail ?? "Nenhum perfil disponível."}</p>
        )}
        {error && (
          <div
            className="mt-4 flex items-center gap-2 text-xs rounded-lg px-3 py-2"
            style={{ background: "rgba(248,113,113,0.12)", color: "var(--bad)" }}
          >
            <AlertTriangle size={13} />
            {error}
          </div>
        )}
        <p className="text-[11px] text-[var(--text-2)] mt-4 leading-relaxed">
          Isso troca o governor de CPU (intel_pstate) de verdade. A parte específica de plataforma do Acer
          (WMI/EC, usada pelo NitroSense original) tem um bug conhecido de compatibilidade neste modelo e fica de
          fora por enquanto — o efeito prático de desempenho vem principalmente do CPU mesmo.
        </p>
      </Card>
    </div>
  );
}
