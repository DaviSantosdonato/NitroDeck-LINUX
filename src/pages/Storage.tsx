import { HardDrive } from "lucide-react";
import type { HardwareSnapshot } from "../types/hardware";
import { Card, CardHeader } from "../components/Card";
import { StatusPill } from "../components/StatusPill";
import { celsius } from "../lib/format";

export function StoragePage({ snap }: { snap: HardwareSnapshot }) {
  const { storage } = snap;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Armazenamento" subtitle={`fonte: ${storage.meta.source}`} right={<StatusPill status={storage.meta.status} />} />
        <div className="space-y-4">
          {storage.devices.map((d) => (
            <div key={d.name} className="flex items-center gap-4 rounded-xl bg-[var(--bg-2)] p-4">
              <div className="w-11 h-11 rounded-xl bg-[var(--bg-3)] flex items-center justify-center shrink-0">
                <HardDrive size={20} className="text-[var(--text-1)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{d.model}</div>
                <div className="text-xs text-[var(--text-2)]">/dev/{d.name} · {d.sizeGb} GB</div>
                <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-3)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${d.usedPct}%`, background: "var(--accent)" }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 shrink-0 text-right">
                <Stat label="Uso" value={`${d.usedPct}%`} />
                <Stat label="Temp." value={celsius(d.tempC)} />
                <Stat label="Desgaste" value={d.wearPct != null ? `${d.wearPct}%` : "—"} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="SMART" subtitle="Ainda não disponível — exige smartctl com privilégio, via um daemon dedicado (fora do escopo desta etapa)" />
        {storage.devices.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-sm py-1.5">
            <span className="text-[var(--text-1)]">{d.model}</span>
            <span
              className="font-medium"
              style={{ color: d.smartOk ? "var(--good)" : "var(--bad)" }}
            >
              {d.smartOk == null ? "—" : d.smartOk ? "Saudável" : "Atenção"}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-[var(--text-2)]">{label}</div>
      <div className="text-sm font-semibold tabular">{value}</div>
    </div>
  );
}
