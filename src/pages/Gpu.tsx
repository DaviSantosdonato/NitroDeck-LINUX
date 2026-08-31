import type { HardwareSnapshot } from "../types/hardware";
import { Card, CardHeader } from "../components/Card";
import { Chart } from "../components/Chart";
import { Ring } from "../components/Ring";
import { StatusPill } from "../components/StatusPill";
import { UnavailablePanel } from "../components/UnavailablePanel";

export function GpuPage({ snap }: { snap: HardwareSnapshot }) {
  const { gpuIntegrated, gpuDiscrete } = snap;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={gpuIntegrated.name}
          subtitle={`fonte: ${gpuIntegrated.meta.source}`}
          right={<StatusPill status={gpuIntegrated.meta.status} />}
        />
        <div className="flex items-center gap-8">
          <Ring value={gpuIntegrated.usagePct} label="Uso" color="var(--info)" />
        </div>
      </Card>

      <Card>
        <CardHeader title="Uso da GPU integrada" subtitle="Últimos ~90 segundos" />
        <Chart data={gpuIntegrated.history} color="#60a5fa" />
      </Card>

      <Card>
        <CardHeader title={gpuDiscrete.name} right={<StatusPill status={gpuDiscrete.meta.status} />} />
        <UnavailablePanel
          status={gpuDiscrete.meta.status}
          title="Sem telemetria disponível para a GPU dedicada"
          detail={gpuDiscrete.meta.detail}
        />
      </Card>
    </div>
  );
}
