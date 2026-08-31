import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ACCENTS, useAccent, type AccentKey } from "../lib/AccentContext";
import { Card, CardHeader } from "../components/Card";
import { AlertTriangle, Check, ShieldAlert, ShieldCheck } from "lucide-react";
import type { HardwareSnapshot } from "../types/hardware";

export function SettingsPage({ snap }: { snap: HardwareSnapshot }) {
  const { accent, setAccent } = useAccent();
  const detected = snap.system.productName ?? "não identificado";

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Cor de destaque" subtitle="Aplicada em toda a interface" />
        <div className="flex gap-3">
          {(Object.keys(ACCENTS) as AccentKey[]).map((key) => {
            const a = ACCENTS[key];
            const active = accent === key;
            return (
              <button
                key={key}
                onClick={() => setAccent(key)}
                className="flex flex-col items-center gap-2 group"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{ background: a.value, boxShadow: active ? `0 0 0 3px var(--bg-1), 0 0 0 5px ${a.value}` : "none" }}
                >
                  {active && <Check size={16} color="#fff" strokeWidth={3} />}
                </div>
                <span className="text-xs text-[var(--text-2)]">{a.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Sobre este modo" />
        <p className="text-xs text-[var(--text-2)] leading-relaxed">
          O NitroDeck lê sensores reais do sistema (<code className="text-[var(--text-1)]">/proc</code>,{" "}
          <code className="text-[var(--text-1)]">/sys</code>, e comandos somente-leitura como{" "}
          <code className="text-[var(--text-1)]">lspci</code>/<code className="text-[var(--text-1)]">df</code>/
          <code className="text-[var(--text-1)]">powerprofilesctl</code>), sem privilégio de root, em qualquer PC
          Linux. Ventoinhas, limite de carga da bateria, calibração, carregamento via USB e os extras do driver{" "}
          <code className="text-[var(--text-1)]">linuwu_sense</code> têm controle real, mas por padrão só no modelo
          exato confirmado (<code className="text-[var(--text-1)]">{"Nitro ANV15-52"}</code>) — nesse caso o app
          nunca fabrica um valor: se algo não bate, a seção some ou vira somente leitura. Os ajustes que exigem root
          pedem sua senha a cada alteração; nenhum outro processo do app roda como root.
        </p>
        <p className="text-xs mt-3 pt-3 border-t border-[var(--border-1)]" style={{ color: "var(--text-2)" }}>
          Modelo detectado neste PC: <strong className="text-[var(--text-0)]">{detected}</strong> —{" "}
          {snap.system.modelConfirmed ? (
            <span style={{ color: "var(--good)" }}>bate com o confirmado, controles liberados</span>
          ) : (
            <span style={{ color: "var(--warn)" }}>não é o modelo validado por nós</span>
          )}
          .
        </p>
      </Card>

      {!snap.system.modelConfirmed && <UnvalidatedModelCard snap={snap} />}

      <Card>
        <CardHeader title="Segurança das ventoinhas" />
        <p className="text-xs text-[var(--text-2)] leading-relaxed">
          Ao fechar o app normalmente, ele tenta reverter as ventoinhas para automático. Como reforço, um watchdog
          independente (<code className="text-[var(--text-1)]">nitrodeck-fan-watchdog</code>, serviço systemd de
          usuário) verifica a cada 5 segundos: se as ventoinhas estiverem em modo manual e o app não estiver mais
          rodando — por exemplo após um travamento — ele força a volta ao automático sozinho.
        </p>
      </Card>
    </div>
  );
}

function UnvalidatedModelCard({ snap }: { snap: HardwareSnapshot }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowed = snap.system.controlsAllowed;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await invoke(allowed ? "revoke_hardware_risk" : "accept_hardware_risk");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!snap.system.linuwuSensePresent) {
    const isAcer = (snap.system.vendor ?? "").toLowerCase().includes("acer");
    return isAcer ? <InstallDriverCard snap={snap} /> : <NoDriverCard />;
  }

  return (
    <Card>
      <CardHeader
        title="Ativar controles num modelo não validado"
        right={
          allowed ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              <ShieldCheck size={12} /> ativado por você
            </span>
          ) : undefined
        }
      />
      <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: "rgba(245,158,11,0.1)" }}>
        <ShieldAlert size={18} className="shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />
        <div className="text-xs leading-relaxed" style={{ color: "var(--text-1)" }}>
          <p className="mb-2">
            Detectamos o driver <code className="text-[var(--text-0)]">linuwu_sense</code> ativo, mas este PC (
            <strong>{snap.system.productName ?? "modelo desconhecido"}</strong>) não é o modelo que validamos (
            <strong>Nitro ANV15-52</strong>). As mesmas rotinas de ventoinha, bateria e extras costumam funcionar
            em outros notebooks Acer Nitro/Predator que usam esse driver, mas <strong>nunca testamos no seu
            modelo exato</strong> — os registradores WMI variam por modelo, então um comportamento inesperado
            (leitura errada, ventoinha não responder, etc.) é possível. Isso é uma decisão sua, não nossa.
          </p>
          <button
            onClick={toggle}
            disabled={busy}
            className="text-xs font-medium px-3 py-2 rounded-lg disabled:opacity-50"
            style={
              allowed
                ? { background: "var(--bg-3)", color: "var(--text-1)" }
                : { background: "var(--warn)", color: "#1a1400" }
            }
          >
            {busy ? "Aplicando..." : allowed ? "Desativar controles não validados" : "Entendo o risco, ativar mesmo assim"}
          </button>
        </div>
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
    </Card>
  );
}

function NoDriverCard() {
  return (
    <Card>
      <CardHeader title="Controles de hardware" />
      <p className="text-xs text-[var(--text-2)] leading-relaxed">
        O driver <code className="text-[var(--text-1)]">linuwu_sense</code> não foi detectado neste PC — sem ele não
        existe nada pra liberar. Esta seção fica só leitura, o que é esperado fora de um Acer Nitro/Predator.
      </p>
    </Card>
  );
}

function InstallDriverCard({ snap }: { snap: HardwareSnapshot }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function install() {
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      await invoke("install_hardware_driver");
      setOk(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Instalar driver de hardware (linuwu_sense)" />
      <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: "rgba(245,158,11,0.1)" }}>
        <ShieldAlert size={18} className="shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />
        <div className="text-xs leading-relaxed" style={{ color: "var(--text-1)" }}>
          <p className="mb-2">
            Detectamos um Acer (<strong>{snap.system.productName ?? "modelo desconhecido"}</strong>) mas o driver{" "}
            <code className="text-[var(--text-0)]">linuwu_sense</code> ainda não está instalado. Ele compila um
            módulo de kernel que fala diretamente com o firmware da placa-mãe (WMI/EC) — validamos isso a fundo só
            no Nitro ANV15-52. Em outro modelo Acer, pode funcionar bem, funcionar parcialmente, ou nada acontecer;
            é uma decisão sua instalar. Depois de instalado, o controle de hardware em si ainda fica bloqueado até
            você confirmar de novo abaixo (ou automático, se o modelo bater).
          </p>
          <button
            onClick={install}
            disabled={busy}
            className="text-xs font-medium px-3 py-2 rounded-lg disabled:opacity-50"
            style={{ background: "var(--warn)", color: "#1a1400" }}
          >
            {busy ? "Instalando (pode pedir sua senha)..." : "Instalar driver mesmo assim"}
          </button>
        </div>
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
      {ok && !error && (
        <p className="mt-3 text-xs" style={{ color: "var(--good)" }}>
          Driver instalado. Pode levar alguns segundos até as telas atualizarem.
        </p>
      )}
    </Card>
  );
}
