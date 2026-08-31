import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { HardwareSnapshot, ToggleFeature } from "../types/hardware";
import { Card, CardHeader } from "../components/Card";
import { StatusPill } from "../components/StatusPill";
import { Toggle } from "../components/Toggle";

export function ExtrasPage({ snap }: { snap: HardwareSnapshot }) {
  const { extras } = snap;
  const rootToggles = [extras.backlightTimeout, extras.bootAnimationSound, extras.lcdOverride];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Recursos extras (linuwu_sense)"
          subtitle={`fonte: ${extras.meta.source}`}
          right={<StatusPill status={extras.meta.status} />}
        />
        <p className="text-xs text-[var(--text-2)] leading-relaxed">
          Recursos adicionais expostos pelo driver de comunidade instalado neste notebook. Itens marcados como "não
          suportado" existem no driver, mas este hardware exato não implementa esse recurso — o próprio firmware
          respondeu isso, não é uma limitação do NitroDeck.
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Requerem privilégio de administrador"
          subtitle="Cada alteração pede autenticação (pkexec) na hora"
        />
        <div className="space-y-4">
          {rootToggles.map((t) => (
            <RootToggleRow key={t.id} feature={t} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function RootToggleRow({ feature }: { feature: ToggleFeature }) {
  const [value, setValue] = useState(feature.enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setValue(next);
    setBusy(true);
    setError(null);
    try {
      await invoke("set_extra_root_toggle", { field: feature.id, enabled: next });
    } catch (err) {
      setError(String(err));
      setValue(!next);
    } finally {
      setBusy(false);
    }
  }

  if (!feature.supported) {
    return (
      <div className="flex items-center justify-between opacity-50">
        <div>
          <div className="text-sm font-medium">{feature.label}</div>
          <p className="text-xs text-[var(--text-2)] mt-0.5">Não suportado neste hardware</p>
        </div>
        <Toggle checked={false} onChange={() => {}} disabled />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--bg-2)] p-4">
      <div className="flex items-center justify-between">
        <div className="max-w-md">
          <div className="text-sm font-medium flex items-center gap-2">
            {feature.label}
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-2)]">
              <ShieldAlert size={11} /> root
            </span>
          </div>
          <p className="text-xs text-[var(--text-2)] mt-0.5">{feature.description}</p>
        </div>
        <Toggle checked={value} onChange={toggle} disabled={busy} />
      </div>
      {error && (
        <div
          className="mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2"
          style={{ background: "rgba(248,113,113,0.12)", color: "var(--bad)" }}
        >
          <AlertTriangle size={13} />
          {error}
        </div>
      )}
    </div>
  );
}
