import type { ReactNode } from "react";
import clsx from "clsx";

export function Card({
  children,
  className,
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={clsx(
        "glass rounded-2xl p-5 animate-fade-in",
        glow && "accent-glow",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-0)]">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--text-2)] mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
