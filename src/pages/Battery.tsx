import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle } from "lucide-react";
import type { HardwareSnapshot } from "../types/hardware";
import { Card, CardHeader } from "../components/Card";
import { Ring } from "../components/Ring";
import { StatusPill } from "../components/StatusPill";
import { Toggle } from "../components/Toggle";
import { minutes, watts } from "../lib/format";
import { UnavailablePanel } from "../components/UnavailablePanel";

export function BatteryPage({ snap }: { snap: HardwareSnapshot }) {
  const { battery, extras } = snap;
  const statusLabel: Record<typeof battery.status, string> = {
    charging: "Carregando",
    discharging: "Descarregando",
    full: "Cheia",
    "not-charging": "Não carregando",
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Bateria" subtitle={`fonte: ${battery.meta.source}`} right={<StatusPill status={battery.meta.status} />} />
        <div className="flex flex-wrap items-center gap-8">
          <Ring value={battery.percent} label={statusLabel[battery.status]} color="var(--warn)" />
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <Stat label="Ciclos de carga" value={String(battery.cycleCount)} />
            <Stat label="Saúde" value={`${battery.healthPct}%`} />
            <Stat label="Potência atual" value={watts(battery.powerNowW)} />
            <Stat label="Tempo restante" value={minutes(battery.timeRemainingMin)} />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Limite de carga (proteção de longevidade)" />
        {battery.chargeLimitSupported ? (
          <ChargeLimitControl enabled={battery.chargeLimitEnabled} />
        ) : (
          <UnavailablePanel
            status="unavailable"
            title="Sem interface de limite de carga neste hardware"
            detail="Nenhuma interface confiável de limite de carga foi encontrada para esta bateria."
          />
        )}
      </Card>

      <Card>
        <CardHeader title="Carregamento via USB (com o notebook desligado)" />
        {extras.usbCharging.supported ? (
          <UsbChargingControl level={extras.usbCharging.level} />
        ) : (
          <UnavailablePanel status="unavailable" title="Não suportado neste hardware" />
        )}
      </Card>

      <Card>
        <CardHeader title="Calibração de bateria" />
        {extras.batteryCalibration.supported ? (
          <CalibrationControl enabled={extras.batteryCalibration.enabled} description={extras.batteryCalibration.description} />
        ) : (
          <UnavailablePanel status="unavailable" title="Não suportado neste hardware" />
        )}
      </Card>
    </div>
  );
}

function ChargeLimitControl({ enabled }: { enabled: boolean | null }) {
  const [value, setValue] = useState(enabled ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setValue(next);
    setBusy(true);
    setError(null);
    try {
      await invoke("set_battery_charge_limit", { enabled: next });
    } catch (err) {
      setError(String(err));
      setValue(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Limitar carga a 80%</div>
          <p className="text-xs text-[var(--text-2)] mt-1 max-w-md">
            Reduz o desgaste da bateria em uso prolongado na tomada, parando de carregar em ~80%.
          </p>
        </div>
        <Toggle checked={value} onChange={toggle} disabled={busy} />
      </div>
      {error && <ErrorLine text={error} />}
    </div>
  );
}

function UsbChargingControl({ level }: { level: 0 | 10 | 20 | 30 }) {
  const [value, setValue] = useState(level);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(next: 0 | 10 | 20 | 30) {
    const prev = value;
    setValue(next);
    setBusy(true);
    setError(null);
    try {
      await invoke("set_usb_charging", { level: next });
    } catch (err) {
      setError(String(err));
      setValue(prev);
    } finally {
      setBusy(false);
    }
  }

  const options: { v: 0 | 10 | 20 | 30; label: string }[] = [
    { v: 0, label: "Desligado" },
    { v: 10, label: "Até 10%" },
    { v: 20, label: "Até 20%" },
    { v: 30, label: "Até 30%" },
  ];

  return (
    <div>
      <p className="text-xs text-[var(--text-2)] mb-3 max-w-md">
        Permite carregar outros dispositivos pela porta USB mesmo com o notebook desligado, até a bateria cair no
        limite escolhido.
      </p>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.v}
            disabled={busy}
            onClick={() => apply(o.v)}
            className="text-xs px-3 py-1.5 rounded-full disabled:opacity-50"
            style={
              value === o.v
                ? { background: "var(--accent-soft)", color: "var(--accent)" }
                : { background: "var(--bg-3)", color: "var(--text-2)" }
            }
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <ErrorLine text={error} />}
    </div>
  );
}

function CalibrationControl({ enabled, description }: { enabled: boolean; description: string }) {
  const [value, setValue] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setValue(next);
    setBusy(true);
    setError(null);
    try {
      await invoke("set_battery_calibration", { enabled: next });
    } catch (err) {
      setError(String(err));
      setValue(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="max-w-md">
          <div className="text-sm font-medium">{value ? "Calibrando..." : "Iniciar calibração"}</div>
          <p className="text-xs text-[var(--text-2)] mt-1">{description}</p>
        </div>
        <Toggle checked={value} onChange={toggle} disabled={busy} />
      </div>
      {error && <ErrorLine text={error} />}
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <div
      className="mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2"
      style={{ background: "rgba(248,113,113,0.12)", color: "var(--bad)" }}
    >
      <AlertTriangle size={13} />
      {text}
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
