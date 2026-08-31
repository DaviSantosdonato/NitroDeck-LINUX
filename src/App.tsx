import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { AccentProvider } from "./lib/AccentContext";
import { useHardwareSnapshot } from "./lib/useSnapshot";
import { Overview } from "./pages/Overview";
import { CpuPage } from "./pages/Cpu";
import { GpuPage } from "./pages/Gpu";
import { MemoryPage } from "./pages/Memory";
import { BatteryPage } from "./pages/Battery";
import { StoragePage } from "./pages/Storage";
import { FansPage } from "./pages/Fans";
import { PowerPage } from "./pages/Power";
import { ExtrasPage } from "./pages/Extras";
import { ProcessesPage } from "./pages/Processes";
import { SettingsPage } from "./pages/Settings";

export type PageId =
  | "overview"
  | "cpu"
  | "gpu"
  | "memory"
  | "battery"
  | "storage"
  | "fans"
  | "power"
  | "extras"
  | "processes"
  | "settings";

function AppShell() {
  const [page, setPage] = useState<PageId>("overview");
  const snap = useHardwareSnapshot(2000);

  return (
    <div className="flex h-screen w-screen">
      <Sidebar page={page} onNavigate={setPage} snap={snap} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar page={page} />
        <main className="flex-1 overflow-y-auto p-6">
          {page === "overview" && <Overview snap={snap} />}
          {page === "cpu" && <CpuPage snap={snap} />}
          {page === "gpu" && <GpuPage snap={snap} />}
          {page === "memory" && <MemoryPage snap={snap} />}
          {page === "battery" && <BatteryPage snap={snap} />}
          {page === "storage" && <StoragePage snap={snap} />}
          {page === "fans" && <FansPage snap={snap} />}
          {page === "power" && <PowerPage snap={snap} />}
          {page === "extras" && <ExtrasPage snap={snap} />}
          {page === "processes" && <ProcessesPage snap={snap} />}
          {page === "settings" && <SettingsPage snap={snap} />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AccentProvider>
      <AppShell />
    </AccentProvider>
  );
}
