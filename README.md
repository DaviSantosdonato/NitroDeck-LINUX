# NitroDeck Linux

**Gerenciador de hardware nativo para notebooks Linux** — leitura em tempo real de CPU, GPU, memória, bateria, armazenamento, temperaturas e processos, com controle de verdade (ventoinhas, energia, bateria) onde o hardware permite. Construído com Tauri 2 + Rust + React, roda leve, nunca pede root pra abrir, e nunca inventa um número quando não consegue ler algo de verdade.

Feito originalmente para o Acer Nitro ANV15-52 (via o driver de comunidade [Linuwu-Sense](https://github.com/0x7375646F/Linuwu-Sense)), mas a parte de monitoramento funciona em **qualquer PC Linux** — o app detecta o hardware sozinho.

---

## O que ele faz

| Tela | O que mostra | Controle real? |
|---|---|---|
| **Visão Geral** | Resumo do PC, temperaturas de todos os sensores agrupadas, sugestão de % de ventoinha | — |
| **Processador** | Uso, frequência, temperatura, potência (RAPL), governor de CPU, Turbo Boost, limites de potência PL1/PL2 | ✅ governor, turbo, PL1/PL2 |
| **Gráficos** | GPU integrada e dedicada — identificação sempre; uso/VRAM/temperatura/potência quando o driver expõe | — |
| **Memória** | Uso de RAM e swap ao vivo | — |
| **Bateria** | Percentual, ciclos, saúde, limite de carga (80%), calibração, carregamento via USB | ✅ no hardware suportado |
| **Armazenamento** | Discos, uso, temperatura | — |
| **Ventoinhas** | RPM real, controle manual com piso de segurança, volta automática se o app cair | ✅ no hardware suportado |
| **Energia** | Perfil ativo (Economia/Equilibrado/Desempenho), troca real via `power-profiles-daemon` | ✅ |
| **Processos** | Lista por CPU/memória, encerrar processo, abrir programa com teto de memória/CPU (cgroups) e GPU dedicada (PRIME offload) | ✅ |
| **Extras** | Recursos do driver Acer (luz do teclado, som de boot, LCD override) | ✅ no hardware suportado |

## Instalação

Baixe o `.deb` mais recente em [Releases](../../releases) e instale:

```bash
sudo apt install ./NitroDeck-Linux_*.deb
```

Isso já deixa tudo pronto sozinho:
- Ícone no menu de aplicativos (nada de terminal)
- Comando `nitrodeck` no terminal, se preferir (abre em segundo plano, devolve o prompt na hora)
- Abre automaticamente no login
- Serviço de segurança das ventoinhas rodando em segundo plano desde a instalação

Pra abrir: clique no ícone "NitroDeck Linux" no menu, ou digite `nitrodeck` num terminal.

### Compilar do zero

```bash
git clone https://github.com/DaviSantosdonato/NitroDeck-LINUX.git
cd NitroDeck-LINUX
npm install
npm run tauri build -- --bundles deb
sudo apt install ./src-tauri/target/release/bundle/deb/*.deb
```

Requer Node.js, Rust (`cargo`) e as dependências de sistema do Tauri ([guia oficial](https://v2.tauri.app/start/prerequisites/)).

## Por que confiar nele

- **Nunca roda como root.** A janela é sempre um processo normal do seu usuário. Os poucos ajustes que exigem root (3 no total) pedem sua senha via `pkexec` a cada uso — nunca de forma silenciosa, nunca com sudoers sem senha.
- **Nunca inventa leitura.** Se um sensor não existe ou não responde, a tela mostra "indisponível" — nunca um zero ou um valor de exemplo disfarçado de dado real.
- **Controle de hardware é opt-in por modelo.** Ventoinha, bateria e extras só ficam ativos automaticamente no modelo exato que validamos (Nitro ANV15-52). Em outro Acer Nitro/Predator com o mesmo driver, o app mostra um aviso claro e só libera se você confirmar explicitamente que quer usar por sua conta — nunca por padrão.
- **Ventoinha tem rede de segurança dupla.** Fechar o app tenta voltar pro automático; se travar, um serviço systemd independente força um piso seguro sozinho em poucos segundos — mesmo com o app fechado ou crashado.
- **Escrita de hardware nunca escala privilégio à toa.** Os campos que só precisam de grupo (ventoinha, bateria, extras) usam o grupo suplementar do driver via `sg`, nunca `sudo`/root.

## Compatibilidade

- **Qualquer distro Linux com um ambiente gráfico** (testado em Parrot OS/Debian, deve funcionar em qualquer sistema baseado em systemd + GTK/Wayland ou X11).
- **Monitoramento**: funciona em qualquer PC — CPU, memória, disco, temperaturas e processos são lidos via `/proc`/`/sys`, sem dependência de fabricante.
- **Controle de ventoinha/bateria/extras**: exige o driver [Linuwu-Sense](https://github.com/0x7375646F/Linuwu-Sense) instalado à parte (não é automatizado por este projeto) e é específico de notebooks Acer Nitro/Predator com WMI compatível. Outros fabricantes (Dell, Lenovo, Asus, HP) usam mecanismos completamente diferentes e não têm controle implementado ainda.
- **GPU dedicada NVIDIA**: telemetria completa (uso/VRAM/temperatura/potência) requer o driver proprietário da NVIDIA instalado à parte.

## Arquitetura

```
crates/nitrodeck-core/      # Tipos compartilhados (espelham src/types/hardware.ts)
crates/nitrodeck-hardware/  # Leitura/escrita real de hardware (procfs/sysfs/comandos)
src-tauri/                  # Shell Tauri, comandos expostos ao frontend
src/                        # React + TypeScript + Tailwind
packaging/                  # Scripts e unidades systemd empacotados no .deb
```

## Licença

Ainda não definida — se for redistribuir, confirme com o autor antes.
