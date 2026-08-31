import type { HardwareSnapshot } from "../types/hardware";
import { Card, CardHeader } from "../components/Card";
import { Chart } from "../components/Chart";
import { StatusPill } from "../components/StatusPill";
import { ProcessTable } from "../components/ProcessTable";
import { mb } from "../lib/format";

export function MemoryPage({ snap }: { snap: HardwareSnapshot }) {
  const { memory, processes } = snap;
  const memPct = (memory.usedMb / memory.totalMb) * 100;
  const swapPct = memory.swapTotalMb ? (memory.swapUsedMb / memory.swapTotalMb) * 100 : 0;
  const byMemory = [...processes.processes].sort((a, b) => b.memMb - a.memMb);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Memória RAM" subtitle={`fonte: ${memory.meta.source}`} right={<StatusPill status={memory.meta.status} />} />
        <div className="grid grid-cols-3 gap-6">
          <Stat label="Usada" value={mb(memory.usedMb)} />
          <Stat label="Total" value={mb(memory.totalMb)} />
          <Stat label="Uso" value={`${memPct.toFixed(1)}%`} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Uso de RAM ao longo do tempo" />
        <Chart data={memory.history} color="#34d399" />
      </Card>

      <Card>
        <CardHeader title="Swap" />
        <div className="grid grid-cols-3 gap-6">
          <Stat label="Usada" value={mb(memory.swapUsedMb)} />
          <Stat label="Total" value={mb(memory.swapTotalMb)} />
          <Stat label="Uso" value={`${swapPct.toFixed(1)}%`} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Limitar memória de processos"
          subtitle="Ordenado por consumo de RAM — mesmo mecanismo de cgroups da aba Processos, sem root"
          right={<StatusPill status={processes.meta.status} compact />}
        />
        <ProcessTable processes={byMemory} />
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
