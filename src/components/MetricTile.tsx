import type { ReactNode } from "react";
import type { Sample } from "../types/hardware";
import { Sparkline } from "./Sparkline";

export function MetricTile({
  icon,
  label,
  value,
  unit,
  history,
  color = "var(--accent)",
  max = 100,
  footer,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  history?: Sample[];
  color?: string;
  max?: number;
  footer?: ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-4 animate-fade-in flex flex-col">
      <div className="flex items-center gap-2 text-[var(--text-2)] mb-3">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-2xl font-bold tabular">{value}</span>
        {unit && <span className="text-xs text-[var(--text-2)]">{unit}</span>}
      </div>
      {history && history.length > 1 && (
        <div className="mt-2 -mx-1">
          <Sparkline data={history} color={color} max={max} height={36} />
        </div>
      )}
      {footer && <div className="mt-2 text-[11px] text-[var(--text-2)]">{footer}</div>}
    </div>
  );
}
