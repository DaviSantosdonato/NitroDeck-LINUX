import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { CpuState, HardwareSnapshot } from "../types/hardware";
import { Card, CardHeader } from "../components/Card";
import { Chart } from "../components/Chart";
import { Ring } from "../components/Ring";
import { StatusPill } from "../components/StatusPill";
import { Toggle } from "../components/Toggle";
import { celsius, mhz, watts } from "../lib/format";
import clsx from "clsx";

const GOVERNOR_LABEL: Record<string, string> = {
  performance: "Desempenho",
  powersave: "Economia",
  schedutil: "Automático (schedutil)",
  ondemand: "Sob demanda",
  conservative: "Conservador",
};

export function CpuPage({ snap }: { snap: HardwareSnapshot }) {
  const { cpu } = snap;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={cpu.model}
          subtitle={`${cpu.cores} núcleos · ${cpu.threads} threads · fonte: ${cpu.meta.source}`}
          right={<StatusPill status={cpu.meta.status} />}
        />
        <div className="flex flex-wrap items-center gap-8">
          <Ring value={cpu.usagePct} label="Uso total" />
          <div className="grid grid-cols-3 gap-6">
            <Stat label="Frequência" value={mhz(cpu.freqMhz)} />
            <Stat label="Temperatura" value={celsius(cpu.packageTempC)} />
            <Stat label="Potência (RAPL)" value={watts(cpu.packagePowerW)} />
          </div>
        </div>
      </Card>

      {cpu.availableGovernors.length > 0 && (
        <Card>
          <CardHeader
            title="Governor de frequência"
            subtitle="Controla como o CPU escala a frequência conforme a carga"
          />
          <GovernorControl current={cpu.governor} options={cpu.availableGovernors} />
        </Card>
      )}

      {(cpu.turboEnabled !== null || cpu.powerLimitPl1W !== null) && (
        <Card>
          <CardHeader
            title="Desempenho avançado (overclock)"
            subtitle="Este notebook não permite ajuste de multiplicador/voltagem (chip móvel travado pela Intel) — isto ajusta o teto de potência real que a EC permite ao CPU sustentar"
          />
          <OverclockControl cpu={cpu} />
        </Card>
      )}

      <Card>
        <CardHeader title="Uso ao longo do tempo" subtitle="Últimos ~90 segundos" />
        <Chart data={cpu.history} color="#e11d48" />
      </Card>

      <Card>
        <CardHeader title="Uso por núcleo" />
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {cpu.perCoreUsage.map((u, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-full h-20 bg-[var(--bg-3)] rounded-lg relative overflow-hidden flex items-end">
                <div
                  className="w-full rounded-lg transition-all duration-500"
                  style={{ height: `${u}%`, background: "var(--accent)" }}
                />
              </div>
              <span className="text-[10px] text-[var(--text-2)]">C{i}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--text-2)] mb-0.5">{label}</div>
      <div className="text-base font-semibold tabular">{value}</div>
    </div>
  );
}

function GovernorControl({ current, options }: { current: string | null; options: string[] }) {
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(governor: string) {
    const prev = value;
    setValue(governor);
    setBusy(true);
    setError(null);
    try {
      await invoke("set_cpu_governor", { governor });
    } catch (err) {
      setError(String(err));
      setValue(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        {options.map((g) => {
          const active = value === g;
          return (
            <button
              key={g}
              onClick={() => apply(g)}
              disabled={busy}
              className={clsx(
                "px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50",
                active ? "text-white" : "text-[var(--text-1)] hover:bg-[var(--bg-3)]",
              )}
              style={{ background: active ? "var(--accent)" : "var(--bg-2)" }}
            >
              {GOVERNOR_LABEL[g] ?? g}
            </button>
          );
        })}
        <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-2)] ml-1">
          <ShieldAlert size={11} /> pede senha (root)
        </span>
      </div>
      {error && (
        <div
          className="mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2"
          style={{ background: "rgba(248,113,113,0.12)", color: "var(--bad)" }}
        >
          <AlertTriangle size={13} />
          {error}
        </div>
      )}
    </div>
  );
}

function OverclockControl({ cpu }: { cpu: CpuState }) {
  const [turbo, setTurbo] = useState(cpu.turboEnabled);
  const [pl1, setPl1] = useState(cpu.powerLimitPl1W ?? cpu.powerLimitPl1MaxW);
  const [pl2, setPl2] = useState(cpu.powerLimitPl2W ?? cpu.powerLimitPl2MaxW);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function toggleTurbo(next: boolean) {
    setTurbo(next);
    setBusy(true);
    setError(null);
    try {
      await invoke("set_cpu_turbo", { enabled: next });
    } catch (err) {
      setError(String(err));
      setTurbo(!next);
    } finally {
      setBusy(false);
    }
  }

  async function applyLimits() {
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      await invoke("set_cpu_power_limits", { pl1W: pl1, pl2W: pl2 });
      setOk(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {cpu.turboEnabled !== null && (
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Turbo Boost</div>
            <p className="text-xs text-[var(--text-2)] mt-0.5">Permite o CPU passar da frequência base em picos de carga</p>
          </div>
          <Toggle checked={!!turbo} onChange={toggleTurbo} disabled={busy} />
        </div>
      )}

      {cpu.powerLimitPl1W !== null && (
        <div className="space-y-4">
          <PowerLimitSlider
            label="PL1 — potência sustentada"
            value={pl1}
            min={cpu.powerLimitMinW}
            max={cpu.powerLimitPl1MaxW}
            onChange={setPl1}
          />
          <PowerLimitSlider
            label="PL2 — pico curto (boost)"
            value={pl2}
            min={cpu.powerLimitMinW}
            max={cpu.powerLimitPl2MaxW}
            onChange={setPl2}
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-[var(--text-2)] max-w-sm leading-relaxed">
              Faixa de {cpu.powerLimitMinW}-{cpu.powerLimitPl1MaxW}W (PL1) / até {cpu.powerLimitPl2MaxW}W (PL2) —
              margem de segurança nossa, não um limite oficial da Intel/Acer. O CPU sempre pode se autolimitar por
              temperatura, independente disso.
            </p>
            <button
              onClick={applyLimits}
              disabled={busy}
              className="shrink-0 text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {busy ? "Aplicando..." : "Aplicar"}
            </button>
          </div>
        </div>
      )}

      <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-2)]">
        <ShieldAlert size={11} /> essas mudanças pedem senha (root)
      </span>

      {error && (
        <div
          className="flex items-center gap-2 text-xs rounded-lg px-3 py-2"
          style={{ background: "rgba(248,113,113,0.12)", color: "var(--bad)" }}
        >
          <AlertTriangle size={13} />
          {error}
        </div>
      )}
      {ok && !error && (
        <p className="text-xs" style={{ color: "var(--good)" }}>
          Limites de potência aplicados.
        </p>
      )}
    </div>
  );
}

function PowerLimitSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-[var(--text-1)]">{label}</span>
        <span className="text-[var(--text-2)] tabular">{value.toFixed(0)}W</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
    </div>
  );
}
