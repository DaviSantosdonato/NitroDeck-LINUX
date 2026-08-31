import {
  BatteryMedium,
  Cpu,
  Fan,
  HardDrive,
  LayoutDashboard,
  ListTree,
  MemoryStick,
  MonitorCog,
  Settings,
  Sparkles,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import type { PageId } from "../App";
import type { HardwareSnapshot } from "../types/hardware";

const NAV: { id: PageId; label: string; Icon: typeof Cpu }[] = [
  { id: "overview", label: "Visão Geral", Icon: LayoutDashboard },
  { id: "cpu", label: "Processador", Icon: Cpu },
  { id: "gpu", label: "Gráficos", Icon: MonitorCog },
  { id: "memory", label: "Memória", Icon: MemoryStick },
  { id: "battery", label: "Bateria", Icon: BatteryMedium },
  { id: "storage", label: "Armazenamento", Icon: HardDrive },
  { id: "fans", label: "Ventoinhas", Icon: Fan },
  { id: "power", label: "Energia", Icon: Zap },
  { id: "extras", label: "Extras", Icon: Sparkles },
  { id: "processes", label: "Processos", Icon: ListTree },
];

export function Sidebar({
  page,
  onNavigate,
  snap,
}: {
  page: PageId;
  onNavigate: (p: PageId) => void;
  snap: HardwareSnapshot;
}) {
  const subtitle = snap.system.productName ?? (snap.system.vendor ? snap.system.vendor : "detectando...");
  return (
    <aside className="w-56 shrink-0 h-full flex flex-col border-r border-[var(--border-1)] bg-[var(--bg-1)]">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          N
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">NitroDeck</div>
          <div className="text-[10px] text-[var(--text-2)] leading-tight">{subtitle}</div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ id, label, Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left",
                active
                  ? "bg-[var(--bg-3)] text-[var(--text-0)] font-medium"
                  : "text-[var(--text-1)] hover:bg-[var(--bg-2)] hover:text-[var(--text-0)]",
              )}
            >
              <Icon size={17} strokeWidth={2} style={active ? { color: "var(--accent)" } : undefined} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <button
          onClick={() => onNavigate("settings")}
          className={clsx(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left",
            page === "settings"
              ? "bg-[var(--bg-3)] text-[var(--text-0)] font-medium"
              : "text-[var(--text-1)] hover:bg-[var(--bg-2)] hover:text-[var(--text-0)]",
          )}
        >
          <Settings size={17} strokeWidth={2} style={page === "settings" ? { color: "var(--accent)" } : undefined} />
          Configurações
        </button>
      </div>
    </aside>
  );
}
