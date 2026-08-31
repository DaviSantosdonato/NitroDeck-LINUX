import type { HardwareSnapshot } from "../types/hardware";
import { Card, CardHeader } from "../components/Card";
import { Chart } from "../components/Chart";
import { Ring } from "../components/Ring";
import { StatusPill } from "../components/StatusPill";
import { UnavailablePanel } from "../components/UnavailablePanel";
import { celsius, mb, watts } from "../lib/format";

export function GpuPage({ snap }: { snap: HardwareSnapshot }) {
  const { gpuIntegrated, gpuDiscrete } = snap;
  const hasDiscreteTelemetry = gpuDiscrete.usagePct !== null || gpuDiscrete.tempC !== null;

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
        <CardHeader
          title={gpuDiscrete.name}
          subtitle={`fonte: ${gpuDiscrete.meta.source}`}
          right={<StatusPill status={gpuDiscrete.meta.status} />}
        />

        {hasDiscreteTelemetry ? (
          <>
            <div className="flex flex-wrap items-center gap-8 mb-2">
              <Ring value={gpuDiscrete.usagePct} label="Uso" color="var(--accent)" />
              <div className="grid grid-cols-3 gap-6">
                <Stat label="Temperatura" value={celsius(gpuDiscrete.tempC)} />
                <Stat label="Potência" value={watts(gpuDiscrete.powerW)} />
                <Stat
                  label="VRAM"
                  value={
                    gpuDiscrete.vramUsedMb !== null && gpuDiscrete.vramTotalMb !== null
                      ? `${mb(gpuDiscrete.vramUsedMb)} / ${mb(gpuDiscrete.vramTotalMb)}`
                      : "—"
                  }
                />
              </div>
            </div>
            {gpuDiscrete.meta.detail && (
              <p className="text-xs text-[var(--text-2)] leading-relaxed">{gpuDiscrete.meta.detail}</p>
            )}
          </>
        ) : (
          <UnavailablePanel
            status={gpuDiscrete.meta.status}
            title="Sem telemetria disponível para a GPU dedicada"
            detail={gpuDiscrete.meta.detail}
          />
        )}
      </Card>

      {hasDiscreteTelemetry && (
        <Card>
          <CardHeader title="Uso da GPU dedicada" subtitle="Últimos ~90 segundos" />
          <Chart data={gpuDiscrete.history} color="#e11d48" />
        </Card>
      )}
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
