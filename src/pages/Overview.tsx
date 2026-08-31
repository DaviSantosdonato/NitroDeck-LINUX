import {
  BatteryMedium,
  CircuitBoard,
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
  MonitorCog,
  Thermometer,
  Wifi,
} from "lucide-react";
import type { HardwareSnapshot, TempSensor } from "../types/hardware";
import { MetricTile } from "../components/MetricTile";
import { Card, CardHeader } from "../components/Card";
import { StatusPill } from "../components/StatusPill";
import { celsius, pct, watts } from "../lib/format";

export function Overview({ snap }: { snap: HardwareSnapshot }) {
  const memPct = (snap.memory.usedMb / snap.memory.totalMb) * 100;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs text-[var(--text-2)] mb-1">Acer Nitro ANV15-52</div>
            <div className="text-lg font-semibold">Intel Core i5-13420H · 16 GB RAM · RTX 5050 Laptop</div>
          </div>
          <div className="flex gap-2">
            <StatusPill status="read-only" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricTile
          icon={<Cpu size={14} />}
          label="CPU"
          value={pct(snap.cpu.usagePct)}
          history={snap.cpu.history}
          footer={`${celsius(snap.cpu.packageTempC)} · ${watts(snap.cpu.packagePowerW)}`}
        />
        <MetricTile
          icon={<MonitorCog size={14} />}
          label="GPU integrada"
          value={pct(snap.gpuIntegrated.usagePct)}
          history={snap.gpuIntegrated.history}
          color="var(--info)"
          footer="Intel UHD Graphics"
        />
        <MetricTile
          icon={<MemoryStick size={14} />}
          label="Memória"
          value={pct(memPct)}
          history={snap.memory.history}
          color="var(--good)"
          footer={`${(snap.memory.usedMb / 1000).toFixed(1)} / ${(snap.memory.totalMb / 1000).toFixed(0)} GB`}
        />
        <MetricTile
          icon={<BatteryMedium size={14} />}
          label="Bateria"
          value={pct(snap.battery.percent)}
          color="var(--warn)"
          max={100}
          footer={snap.battery.status === "discharging" ? "Descarregando" : "Carregando"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="md:col-span-2">
          <CardHeader title="GPU dedicada" subtitle={snap.gpuDiscrete.name} right={<StatusPill status={snap.gpuDiscrete.meta.status} />} />
          <p className="text-xs text-[var(--text-2)] leading-relaxed">{snap.gpuDiscrete.meta.detail}</p>
        </Card>

        <Card>
          <CardHeader title="Armazenamento" right={<StatusPill status={snap.storage.meta.status} compact />} />
          {snap.storage.devices.map((d) => (
            <div key={d.name} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--bg-3)] flex items-center justify-center">
                <HardDrive size={16} className="text-[var(--text-1)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.model}</div>
                <div className="text-xs text-[var(--text-2)]">
                  {d.usedPct}% usado · {celsius(d.tempC)}
                </div>
              </div>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="Ventoinhas" right={<StatusPill status={snap.fans.meta.status} compact />} />
          <p className="text-xs text-[var(--text-2)] leading-relaxed">{snap.fans.meta.detail}</p>
        </Card>
        <Card>
          <CardHeader title="Perfil de energia" right={<StatusPill status={snap.power.meta.status} compact />} />
          <div className="flex gap-2">
            {snap.power.profiles.map((p) => (
              <span
                key={p.id}
                className="text-xs px-2.5 py-1 rounded-full"
                style={
                  p.active
                    ? { background: "var(--accent-soft)", color: "var(--accent)" }
                    : { background: "var(--bg-3)", color: "var(--text-2)" }
                }
              >
                {p.label}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <TemperaturesCard snap={snap} />
    </div>
  );
}

function suggestedFanPercent(maxTempC: number): number {
  if (maxTempC < 55) return 0;
  if (maxTempC < 65) return 30;
  if (maxTempC < 75) return 50;
  if (maxTempC < 85) return 70;
  return 100;
}

// Escala fixa 20-100°C só para posicionar a barra de calor — não é limite
// térmico de nada, é só a régua visual.
const HEAT_SCALE_MIN = 20;
const HEAT_SCALE_MAX = 100;

function heatFraction(tempC: number): number {
  const f = (tempC - HEAT_SCALE_MIN) / (HEAT_SCALE_MAX - HEAT_SCALE_MIN);
  return Math.min(1, Math.max(0, f));
}

function tempColor(tempC: number): string {
  if (tempC < 55) return "var(--good)";
  if (tempC < 75) return "var(--warn)";
  return "var(--bad)";
}

const GROUP_ICON: Record<string, typeof Cpu> = {
  CPU: Cpu,
  SSD: HardDrive,
  "Placa-mãe": CircuitBoard,
  "Chassi (EC)": Gauge,
  "Wi-Fi": Wifi,
  GPU: MonitorCog,
};

function groupSensors(sensors: TempSensor[]): { name: string; sensors: TempSensor[] }[] {
  const order: string[] = [];
  const map = new Map<string, TempSensor[]>();
  for (const s of sensors) {
    const name = s.label.split(" — ")[0] ?? s.label;
    if (!map.has(name)) {
      map.set(name, []);
      order.push(name);
    }
    map.get(name)!.push(s);
  }
  return order.map((name) => ({ name, sensors: map.get(name)! }));
}

function probeLabel(fullLabel: string): string {
  const idx = fullLabel.indexOf(" — ");
  return idx === -1 ? fullLabel : fullLabel.slice(idx + 3);
}

function HeatBar({ tempC }: { tempC: number }) {
  return (
    <div className="h-1.5 rounded-full bg-[var(--bg-3)] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${heatFraction(tempC) * 100}%`, background: tempColor(tempC) }}
      />
    </div>
  );
}

function TempGroupCard({ name, sensors }: { name: string; sensors: TempSensor[] }) {
  const Icon = GROUP_ICON[name] ?? Thermometer;
  const maxTemp = Math.max(...sensors.map((s) => s.tempC));
  const isCoreCluster = name === "CPU" && sensors.length > 3;

  return (
    <div className="rounded-xl bg-[var(--bg-2)] p-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--bg-3)] flex items-center justify-center shrink-0">
            <Icon size={14} className="text-[var(--text-1)]" />
          </div>
          <span className="text-xs font-medium text-[var(--text-1)]">{name}</span>
        </div>
        <span className="text-sm font-semibold tabular" style={{ color: tempColor(maxTemp) }}>
          {maxTemp.toFixed(0)}°C
        </span>
      </div>

      {isCoreCluster ? (
        <div className="grid grid-cols-4 gap-1">
          {sensors.map((s) => (
            <div
              key={s.label}
              title={`${probeLabel(s.label)}: ${s.tempC.toFixed(0)}°C`}
              className="rounded-md text-center py-1 text-[10px] font-medium tabular"
              style={{ background: "var(--bg-3)", color: tempColor(s.tempC) }}
            >
              {s.tempC.toFixed(0)}°
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sensors.map((s) => (
            <div key={s.label}>
              {sensors.length > 1 && (
                <div className="flex justify-between text-[10px] text-[var(--text-2)] mb-0.5">
                  <span className="truncate pr-2">{probeLabel(s.label)}</span>
                  <span className="tabular shrink-0">{s.tempC.toFixed(0)}°C</span>
                </div>
              )}
              <HeatBar tempC={s.tempC} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemperaturesCard({ snap }: { snap: HardwareSnapshot }) {
  const { sensors } = snap.temperatures;
  const maxTemp = sensors.length > 0 ? Math.max(...sensors.map((s) => s.tempC)) : null;
  const suggestion = maxTemp !== null ? suggestedFanPercent(maxTemp) : null;
  const groups = groupSensors(sensors);

  return (
    <Card>
      <CardHeader
        title="Temperaturas"
        subtitle={`fonte: ${snap.temperatures.meta.source}`}
        right={<StatusPill status={snap.temperatures.meta.status} compact />}
      />

      {sensors.length === 0 ? (
        <p className="text-xs text-[var(--text-2)]">Nenhum sensor de temperatura encontrado neste sistema.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {groups.map((g) => (
              <TempGroupCard key={g.name} name={g.name} sensors={g.sensors} />
            ))}
          </div>

          {suggestion !== null && (
            <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2.5" style={{ background: "var(--bg-2)" }}>
              <Thermometer size={13} className="mt-0.5 shrink-0 text-[var(--text-2)]" />
              <p className="text-[var(--text-2)] leading-relaxed">
                Ponto mais quente agora: <strong className="text-[var(--text-0)]">{maxTemp?.toFixed(0)}°C</strong>.
                Sugestão nossa (estimativa, não uma tabela oficial da Acer):{" "}
                <strong style={{ color: "var(--accent)" }}>
                  {suggestion === 0 ? "automático já é suficiente" : `~${suggestion}% de ventoinha`}
                </strong>{" "}
                para manter numa faixa saudável. Ajuste manual fica na aba Ventoinhas.
              </p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
