import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, Fan as FanIcon } from "lucide-react";
import type { HardwareSnapshot } from "../types/hardware";
import { Card, CardHeader } from "../components/Card";
import { StatusPill } from "../components/StatusPill";
import { UnavailablePanel } from "../components/UnavailablePanel";

export function FansPage({ snap }: { snap: HardwareSnapshot }) {
  const { fans } = snap;
  const [cpuPct, setCpuPct] = useState(fans.cpuPercent ?? fans.minManualPercent);
  const [gpuPct, setGpuPct] = useState(fans.gpuPercent ?? fans.minManualPercent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mantém os sliders sincronizados com o estado real quando ele muda por
  // fora (outra sessão, ou o próprio app em outra aba/janela).
  useEffect(() => {
    if (fans.mode === "manual") {
      if (fans.cpuPercent != null) setCpuPct(fans.cpuPercent);
      if (fans.gpuPercent != null) setGpuPct(fans.gpuPercent);
    }
  }, [fans.mode, fans.cpuPercent, fans.gpuPercent]);

  async function apply(cpu: number, gpu: number) {
    setBusy(true);
    setError(null);
    try {
      await invoke("set_fan_speed", { cpu, gpu });
    } catch (err) {
      setError(String(err));
      // Nunca deixa em estado incerto: tenta forçar de volta ao automático.
      try {
        await invoke("set_fan_speed", { cpu: 0, gpu: 0 });
      } catch {
        // Se isso também falhar, o erro já mostrado ao usuário é o suficiente.
      }
    } finally {
      setBusy(false);
    }
  }

  if (!fans.monitoringAvailable) {
    return (
      <div className="space-y-5">
        <Card>
          <CardHeader title="Ventoinhas" subtitle={`fonte: ${fans.meta.source}`} right={<StatusPill status={fans.meta.status} />} />
          <UnavailablePanel status={fans.meta.status} title="Monitoramento indisponível" detail={fans.meta.detail} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Ventoinhas"
          subtitle={`fonte: ${fans.meta.source}`}
          right={<StatusPill status={fans.meta.status} />}
        />
        <div className="grid grid-cols-2 gap-4">
          {fans.fans.map((f) => (
            <div key={f.label} className="rounded-xl bg-[var(--bg-2)] p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--bg-3)] flex items-center justify-center">
                <FanIcon size={16} className="text-[var(--text-1)]" />
              </div>
              <div>
                <div className="text-xs text-[var(--text-2)]">{f.label}</div>
                <div className="text-lg font-semibold tabular">
                  {f.rpm == null ? "—" : Math.round(f.rpm)} <span className="text-xs text-[var(--text-2)]">RPM</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {!fans.controlAvailable ? (
        <Card>
          <CardHeader title="Controle manual" />
          <UnavailablePanel
            status="unavailable"
            title="Controle manual indisponível"
            detail={fans.meta.detail ?? "Requer o módulo linuwu_sense confirmado para este modelo exato."}
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Controle manual"
            subtitle={`Modo atual: ${fans.mode === "auto" ? "Automático (firmware)" : "Manual"}`}
            right={
              <button
                onClick={() => apply(0, 0)}
                disabled={busy}
                className="text-xs font-medium px-3 py-1.5 rounded-full disabled:opacity-50"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                Voltar para automático
              </button>
            }
          />

          <div className="space-y-5">
            <FanSlider
              label="CPU"
              value={cpuPct}
              min={fans.minManualPercent}
              onChange={setCpuPct}
            />
            <FanSlider
              label="GPU"
              value={gpuPct}
              min={fans.minManualPercent}
              onChange={setGpuPct}
            />
          </div>

          <div className="flex items-center justify-between mt-5">
            <p className="text-[11px] text-[var(--text-2)] max-w-sm leading-relaxed">
              Valores abaixo de {fans.minManualPercent}% são bloqueados por segurança (margem interna nossa, não é um
              mínimo garantido pelo fabricante). Fechar o app tenta voltar ao automático; se ele travar sem
              conseguir, um watchdog independente (serviço systemd) reverte sozinho em até 5 segundos.
            </p>
            <button
              onClick={() => apply(cpuPct, gpuPct)}
              disabled={busy}
              className="shrink-0 text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {busy ? "Aplicando..." : "Aplicar manual"}
            </button>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ background: "rgba(248,113,113,0.12)", color: "var(--bad)" }}>
              <AlertTriangle size={13} />
              {error}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function FanSlider({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--text-1)]">{label}</span>
        <span className="text-xs tabular text-[var(--text-2)]">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
    </div>
  );
}
