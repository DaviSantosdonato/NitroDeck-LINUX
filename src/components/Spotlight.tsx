import type { ReactNode } from "react";
import clsx from "clsx";

/**
 * The one bold moment per screen — a visually distinct hero card for the
 * single most important real reading (e.g. active power profile + uptime,
 * thermal headroom, fan safety status). Don't use more than one per page;
 * it only works as a signature element if it stays rare.
 *
 * Unlike Card/MetricTile (glass, quiet), Spotlight uses a solid accent
 * gradient surface — reserve it for something the user should notice first.
 */
export function Spotlight({
  eyebrow,
  value,
  unit,
  description,
  icon,
  actions,
  className,
}: {
  eyebrow: string;
  value: string;
  unit?: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-2xl p-5 flex flex-col justify-between animate-fade-in",
        className,
      )}
      style={{
        background:
          "linear-gradient(155deg, var(--bg-2) 0%, var(--bg-1) 55%, var(--accent-soft) 130%)",
        border: "1px solid var(--border-2)",
      }}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-[var(--text-2)]">{eyebrow}</span>
        {icon && <span className="text-[var(--accent)]">{icon}</span>}
      </div>

      <div className="mt-4">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tabular text-[var(--text-0)]">
            {value}
          </span>
          {unit && <span className="text-sm text-[var(--text-2)]">{unit}</span>}
        </div>
        {description && (
          <p className="mt-1 text-xs text-[var(--text-1)]">{description}</p>
        )}
      </div>

      {actions && <div className="mt-4 flex gap-2">{actions}</div>}
    </div>
  );
}
