import { CircleSlash } from "lucide-react";
import type { ProviderStatus } from "../types/hardware";
import { StatusPill } from "./StatusPill";

export function UnavailablePanel({
  status,
  title,
  detail,
}: {
  status: ProviderStatus;
  title: string;
  detail?: string;
}) {
  return (
    <div className="glass rounded-2xl p-8 flex flex-col items-center text-center gap-3 animate-fade-in">
      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--bg-3)]">
        <CircleSlash size={22} className="text-[var(--text-2)]" />
      </div>
      <StatusPill status={status} />
      <h3 className="text-sm font-semibold text-[var(--text-0)]">{title}</h3>
      {detail && <p className="text-xs text-[var(--text-2)] max-w-md leading-relaxed">{detail}</p>}
    </div>
  );
}
