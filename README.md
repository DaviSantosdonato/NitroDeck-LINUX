# NitroDeck Linux

Gerenciador de hardware nativo para notebooks Linux (Tauri 2 + Rust + React/TypeScript + Tailwind).

## Estado atual: Fase 3 — protótipo visual em modo demo

Este é o **protótipo visual**, rodando em **modo demo**: todos os sensores vêm de um
simulador local em `src/lib/simulator.ts`, nunca de hardware real. Nenhum código
lê `/sys`, `/proc` ou D-Bus ainda, e a UI roda sem privilégios.

## Rodar

```bash
npm install
npm run tauri dev
```

## Estrutura

```
src/
  types/hardware.ts      # tipos dos providers (espelham a arquitetura real)
  lib/simulator.ts       # gerador de dados simulados (modo demo)
  lib/useSnapshot.ts     # hook que faz o "tick" do simulador
  lib/AccentContext.tsx  # cor de destaque (rubi/violeta/azul), persistida
  components/            # Card, StatusPill, Ring, Sparkline, Chart (uPlot)...
  pages/                 # Visão Geral, Processador, Gráficos, Memória,
                          # Bateria, Armazenamento, Ventoinhas, Energia, Configurações
src-tauri/                # shell Rust/Tauri (ainda sem lógica de hardware real)
```

## Hardware de referência (Acer Nitro ANV15-52)

Ver diagnóstico completo em `~/parrot-hardware-setup/reports/latest.md`. Resumo
das lacunas que já moldam esta UI:

- GPU dedicada (RTX 5050 Laptop, Blackwell): sem driver compatível hoje → estado "Driver necessário"
- Ventoinhas: nenhum sensor de RPM em hwmon → estado "Recurso indisponível"
- Limite de carga da bateria: sem interface sysfs → estado "Recurso indisponível"
- Iluminação RGB do teclado: sem interface padrão → estado "Recurso indisponível"

## Próximas fases (aguardando autorização)

- Fase 4: telemetria real somente-leitura (CPU/RAM/SSD/bateria) via `nitrodeck-daemon`
- Fase 5: D-Bus + Polkit
- Fase 6: perfis de energia reais (`power-profiles-daemon`)
- Fase 7: controles validados, item a item, cada um com autorização explícita
