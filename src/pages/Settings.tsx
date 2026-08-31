import { ACCENTS, useAccent, type AccentKey } from "../lib/AccentContext";
import { Card, CardHeader } from "../components/Card";
import { Check } from "lucide-react";

export function SettingsPage() {
  const { accent, setAccent } = useAccent();

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
          <code className="text-[var(--text-1)]">powerprofilesctl</code>), sem privilégio de root. Ventoinhas,
          limite de carga da bateria, calibração, carregamento via USB e os extras do driver{" "}
          <code className="text-[var(--text-1)]">linuwu_sense</code> têm controle real, mas só neste modelo exato
          confirmado ({" "}
          <code className="text-[var(--text-1)]">Nitro ANV15-52</code>) — em qualquer outro hardware o app volta a
          ser somente leitura por segurança. Os 3 ajustes que exigem root pedem sua senha a cada alteração; nenhum
          outro processo do app roda como root.
        </p>
      </Card>

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
