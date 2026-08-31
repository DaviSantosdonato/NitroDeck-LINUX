import { Eye } from "lucide-react";
import type { PageId } from "../App";

const TITLES: Record<PageId, string> = {
  overview: "Visão Geral",
  cpu: "Processador",
  gpu: "Gráficos",
  memory: "Memória",
  battery: "Bateria",
  storage: "Armazenamento",
  fans: "Ventoinhas",
  power: "Energia",
  extras: "Extras",
  processes: "Processos",
  settings: "Configurações",
};

export function TopBar({ page }: { page: PageId }) {
  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-[var(--border-1)] bg-[var(--bg-0)]/80 backdrop-blur">
      <h1 className="text-base font-semibold">{TITLES[page]}</h1>
      <div
        className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        title="Leitura real do sistema, sem privilégio. Ventoinha, bateria e extras têm controle real via linuwu_sense, validado só para este modelo exato; nenhum outro escritor toca em hardware ainda."
      >
        <Eye size={13} />
        Leitura real — alguns controles ativos
      </div>
    </header>
  );
}
