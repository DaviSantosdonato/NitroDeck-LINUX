import type { ReactNode } from "react";
import { Card, CardHeader } from "./Card";
import { relativeTime } from "../lib/format";

export type EventTone = "neutral" | "good" | "warn" | "bad";

export interface HardwareEvent {
  id: string;
  icon: ReactNode;
  message: string;
  detail?: string;
  timestamp: number; // epoch ms — real event time, never simulated
  tone?: EventTone;
}

const TONE_COLOR: Record<EventTone, string> = {
  neutral: "var(--text-2)",
  good: "var(--good)",
  warn: "var(--warn)",
  bad: "var(--bad)",
};

/**
 * Chronological log of real hardware/system events — profile switches, fan
 * mode changes, driver load, thermal warnings, battery limit toggles.
 * Only render events NitroDeck actually observed. An empty `events` array
 * means "no events yet", not "loading" — don't fill it with placeholders.
 */
export function EventFeed({
  events,
  title = "Atividade",
  subtitle,
  emptyLabel = "Nenhum evento registrado ainda",
  maxItems = 8,
}: {
  events: HardwareEvent[];
  title?: string;
  subtitle?: string;
  emptyLabel?: string;
  maxItems?: number;
}) {
  const items = events.slice(0, maxItems);

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      {items.length === 0 ? (
        <p className="text-xs text-[var(--text-2)]">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3.5">
          {items.map((e) => (
            <li key={e.id} className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{
                  color: TONE_COLOR[e.tone ?? "neutral"],
                  background: "var(--bg-3)",
                }}
              >
                {e.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--text-0)] leading-snug">
                  {e.message}
                  {e.detail && (
                    <span className="text-[var(--text-2)]"> · {e.detail}</span>
                  )}
                </p>
                <span className="text-[11px] text-[var(--text-2)] tabular">
                  {relativeTime(e.timestamp)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
