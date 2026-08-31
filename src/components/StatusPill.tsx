import type { ProviderStatus } from "../types/hardware";
import { STATUS_LABEL } from "../types/hardware";
import { AlertTriangle, CheckCircle2, CircleSlash, Clock, HelpCircle, PlugZap } from "lucide-react";

const TONE: Record<ProviderStatus, { color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  ok: { color: "#34d399", bg: "rgba(52,211,153,0.12)", Icon: CheckCircle2 },
  "read-only": { color: "#60a5fa", bg: "rgba(96,165,250,0.12)", Icon: CheckCircle2 },
  unavailable: { color: "#7c7c85", bg: "rgba(124,124,133,0.12)", Icon: CircleSlash },
  incompatible: { color: "#f87171", bg: "rgba(248,113,113,0.12)", Icon: AlertTriangle },
  "driver-required": { color: "#fbbf24", bg: "rgba(251,191,36,0.12)", Icon: PlugZap },
  "awaiting-validation": { color: "#fbbf24", bg: "rgba(251,191,36,0.12)", Icon: Clock },
  error: { color: "#f87171", bg: "rgba(248,113,113,0.12)", Icon: HelpCircle },
};

export function StatusPill({ status, compact = false }: { status: ProviderStatus; compact?: boolean }) {
  const { color, bg, Icon } = TONE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ color, background: bg }}
    >
      <Icon size={12} strokeWidth={2.5} />
      {!compact && STATUS_LABEL[status]}
    </span>
  );
}
