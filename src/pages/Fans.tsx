import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, Fan as FanIcon, Thermometer } from "lucide-react";
import type { GenericPwmChannel, HardwareSnapshot } from "../types/hardware";
import { Card, CardHeader } from "../components/Card";
import { StatusPill } from "../components/StatusPill";
import { Toggle } from "../components/Toggle";
import { UnavailablePanel } from "../components/UnavailablePanel";
import { suggestedFanPercent } from "../lib/fanCurve";

export function FansPage({ snap }: { snap: HardwareSnapshot }) {
  const { fans } = snap;
  const [cpuPct, setCpuPct] = useState(fans.cpuPercent ?? fans.minManualPercent);
  const [gpuPct, setGpuPct] = useState(fans.gpuPercent ?? fans.minManualPercent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [curveEnabled, setCurveEnabled] = useState(false);
  const lastCurveTarget = useRef<number | null>(null);

  // Mantém os sliders sincronizados com o estado real quando ele muda por
  // fora (outra sessão, a própria curva automática, ou o app em outra
  // aba/janela).
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

  async function toggleCurve(next: boolean) {
    setCurveEnabled(next);
    if (!next) {
      lastCurveTarget.current = null;
      await apply(0, 0);
    }
  }

  async function backToAuto() {
    setCurveEnabled(false);
    lastCurveTarget.current = null;
    await apply(0, 0);
  }

  // Curva automática de verdade: enquanto ligada, recalcula o alvo a cada
  // snapshot (a partir do sensor mais quente) e só escreve na ventoinha
  // quando o alvo muda — nunca fica reenviando o mesmo valor a cada 2s.
  useEffect(() => {
    if (!curveEnabled) return;
    const sensors = snap.temperatures.sensors;
    if (sensors.length === 0) return;
    const maxTemp = Math.max(...sensors.map((s) => s.tempC));
    const raw = suggestedFanPercent(maxTemp);
    const target = raw === 0 ? 0 : Math.max(fans.minManualPercent, raw);
    if (target !== lastCurveTarget.current) {
      lastCurveTarget.current = target;
      apply(target, target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curveEnabled, snap.temperatures.sensors, fans.minManualPercent]);

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

      {fans.controlAvailable && (
        <Card>
          <CardHeader
            title="Curva automática por temperatura"
            subtitle="Enquanto ligada, a própria ventoinha acompanha o sensor mais quente — sem você precisar mexer em nada"
            right={<Toggle checked={curveEnabled} onChange={toggleCurve} disabled={busy} />}
          />
          <div className="flex items-start gap-2 text-[11px] text-[var(--text-2)] leading-relaxed">
            <Thermometer size={13} className="mt-0.5 shrink-0" />
            <p>
              Abaixo de 55°C fica no automático do firmware; a partir daí sobe em degraus (30/50/70/100%) conforme a
              temperatura mais alta do sistema. É a mesma estimativa mostrada na Visão Geral, só que agora aplicada
              de verdade. Mexer nos sliders abaixo desliga a curva automática.
            </p>
          </div>
        </Card>
      )}

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
            subtitle={`Modo atual: ${curveEnabled ? "Curva automática" : fans.mode === "auto" ? "Automático (firmware)" : "Manual"}`}
            right={
              <button
                onClick={backToAuto}
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
              onChange={(v) => {
                setCurveEnabled(false);
                lastCurveTarget.current = null;
                setCpuPct(v);
              }}
            />
            <FanSlider
              label="GPU"
              value={gpuPct}
              min={fans.minManualPercent}
              onChange={(v) => {
                setCurveEnabled(false);
                lastCurveTarget.current = null;
                setGpuPct(v);
              }}
            />
          </div>

          <div className="flex items-center justify-between mt-5">
            <p className="text-[11px] text-[var(--text-2)] max-w-sm leading-relaxed">
              {curveEnabled
                ? "Os valores acima estão sendo definidos pela curva automática, ao vivo."
                : `Valores abaixo de ${fans.minManualPercent}% são bloqueados por segurança (margem interna nossa, não é um mínimo garantido pelo fabricante). Fechar o app tenta voltar ao automático; se ele travar sem conseguir, um watchdog independente (serviço systemd) reverte sozinho em até 5 segundos.`}
            </p>
            {!curveEnabled && (
              <button
                onClick={() => apply(cpuPct, gpuPct)}
                disabled={busy}
                className="shrink-0 text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {busy ? "Aplicando..." : "Aplicar manual"}
              </button>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ background: "rgba(248,113,113,0.12)", color: "var(--bad)" }}>
              <AlertTriangle size={13} />
              {error}
            </div>
          )}
        </Card>
      )}

      {fans.genericPwm.length > 0 && (
        <Card>
          <CardHeader
            title="Ventoinhas via hwmon (PWM padrão do kernel)"
            subtitle="Não é específico de fabricante — funciona em qualquer chip que exponha pwm/pwm_enable"
          />
          <div className="space-y-4">
            {fans.genericPwm.map((ch) => (
              <GenericPwmRow key={ch.id} channel={ch} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function GenericPwmRow({ channel }: { channel: GenericPwmChannel }) {
  const [value, setValue] = useState(channel.percent ?? 25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(percent: number) {
    setBusy(true);
    setError(null);
    try {
      await invoke("set_generic_fan_pwm", { id: channel.id, percent });
      setValue(percent === 0 ? channel.percent ?? 25 : percent);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-[var(--bg-2)] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--text-1)]">{channel.label}</span>
        <span className="text-[10px] text-[var(--text-2)]">
          {channel.isManual ? "manual" : "automático"} · {channel.percent ?? "—"}%
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={25}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
        />
        <button
          onClick={() => apply(value)}
          disabled={busy}
          className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Aplicar
        </button>
        <button
          onClick={() => apply(0)}
          disabled={busy}
          className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
          style={{ background: "var(--bg-3)", color: "var(--text-1)" }}
        >
          Auto
        </button>
      </div>
      {error && (
        <div className="mt-2 flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ background: "rgba(248,113,113,0.12)", color: "var(--bad)" }}>
          <AlertTriangle size={13} />
          {error}
        </div>
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
