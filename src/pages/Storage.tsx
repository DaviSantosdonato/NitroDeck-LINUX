import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, HardDrive, ShieldCheck, Sparkles } from "lucide-react";
import type { HardwareSnapshot, SmartResult, StorageDevice } from "../types/hardware";
import { Card, CardHeader } from "../components/Card";
import { StatusPill } from "../components/StatusPill";
import { celsius } from "../lib/format";

export function StoragePage({ snap }: { snap: HardwareSnapshot }) {
  const { storage } = snap;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Armazenamento" subtitle={`fonte: ${storage.meta.source}`} right={<StatusPill status={storage.meta.status} />} />
        {storage.meta.detail && (
          <p className="text-[11px] text-[var(--text-2)] mb-3 leading-relaxed">{storage.meta.detail}</p>
        )}
        <div className="space-y-4">
          {storage.devices.map((d) => (
            <StorageDeviceRow key={d.name} device={d} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function StorageDeviceRow({ device }: { device: StorageDevice }) {
  const [smart, setSmart] = useState<SmartResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trimming, setTrimming] = useState<string | null>(null);
  const [trimResult, setTrimResult] = useState<string | null>(null);

  async function checkSmart() {
    setChecking(true);
    setError(null);
    try {
      const result = await invoke<SmartResult>("check_smart", { device: device.name });
      setSmart(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setChecking(false);
    }
  }

  async function trim(mountpoint: string) {
    setTrimming(mountpoint);
    setError(null);
    setTrimResult(null);
    try {
      const result = await invoke<string>("run_fstrim", { mountpoint });
      setTrimResult(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setTrimming(null);
    }
  }

  return (
    <div className="rounded-xl bg-[var(--bg-2)] p-4">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-[var(--bg-3)] flex items-center justify-center shrink-0">
          <HardDrive size={20} className="text-[var(--text-1)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{device.model}</div>
          <div className="text-xs text-[var(--text-2)]">
            /dev/{device.name} · {device.sizeGb.toFixed(0)} GB
            {device.mountpoints.length > 0 && ` · ${device.mountpoints.join(", ")}`}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-3)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${device.usedPct ?? 0}%`, background: "var(--accent)" }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6 shrink-0 text-right">
          <Stat label="Uso" value={device.usedPct != null ? `${device.usedPct.toFixed(0)}%` : "—"} />
          <Stat label="Temp." value={celsius(device.tempC)} />
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--border-1)] flex flex-wrap items-center gap-2">
        <button
          onClick={checkSmart}
          disabled={checking}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 hover:bg-[var(--bg-3)]"
          style={{ color: "var(--text-1)" }}
        >
          <ShieldCheck size={13} />
          {checking ? "Verificando..." : "Verificar SMART"}
        </button>

        {device.mountpoints.map((mp) => (
          <button
            key={mp}
            onClick={() => trim(mp)}
            disabled={trimming === mp}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 hover:bg-[var(--bg-3)]"
            style={{ color: "var(--text-1)" }}
          >
            <Sparkles size={13} />
            {trimming === mp ? "Executando..." : `TRIM (${mp})`}
          </button>
        ))}

        {smart && (
          <span
            className="text-xs font-medium"
            style={{ color: smart.healthy === false ? "var(--bad)" : "var(--good)" }}
          >
            {smart.healthy == null ? "Status: —" : smart.healthy ? "SMART: saudável" : "SMART: atenção"}
            {smart.wearPct != null && ` · desgaste ${smart.wearPct}%`}
          </span>
        )}

        {trimResult && <span className="text-xs" style={{ color: "var(--good)" }}>{trimResult}</span>}
      </div>

      {error && (
        <div
          className="mt-2 flex items-center gap-2 text-xs rounded-lg px-3 py-2"
          style={{ background: "rgba(248,113,113,0.12)", color: "var(--bad)" }}
        >
          <AlertTriangle size={13} />
          {error}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-[var(--text-2)]">{label}</div>
      <div className="text-sm font-semibold tabular">{value}</div>
    </div>
  );
}
