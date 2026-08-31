# NitroDeck Linux

**Gerenciador de hardware nativo para notebooks e desktops Linux** — leitura em tempo real de CPU, GPU, memória, bateria, armazenamento, temperaturas e processos, com controle de verdade (ventoinhas, energia, bateria, memória) onde o hardware permite. Construído com Tauri 2 + Rust + React, roda leve, nunca pede root pra abrir, e nunca inventa um número quando não consegue ler algo de verdade.

Feito originalmente para o Acer Nitro ANV15-52, mas a parte de monitoramento — e boa parte do controle — funciona em **qualquer PC Linux**: o app detecta o hardware sozinho, sem configuração manual.

---

## Autoria

- **Criado por [Davi Santos Donato](https://github.com/DaviSantosdonato)** — dono do projeto, do hardware de referência (o notebook usado pra validar tudo) e das decisões de produto e segurança.
- **Desenvolvido em par com o Claude (Anthropic)**, agente de IA que escreveu o código, testou no hardware real via terminal e câmera de tela, e documentou as decisões técnicas junto com o autor.
- **Driver de ventoinha/bateria da Acer**: fork do projeto [Linuwu-Sense](https://github.com/0x7375646F/Linuwu-Sense), de **0x7375646F** — engenharia reversa dos métodos WMI/ACPI da Acer, sem a qual o controle de hardware deste app não existiria. Créditos completos e licença original preservados em [`driver/linuwu-sense/ATTRIBUTION.md`](driver/linuwu-sense/ATTRIBUTION.md).

## O que ele faz

| Tela | O que mostra | Controle real? |
|---|---|---|
| **Visão Geral** | Destaque do status térmico (temperatura mais alta + sugestão de ventoinha), 4 indicadores rápidos (CPU/GPU/memória/bateria), GPU dedicada, armazenamento, ventoinhas, perfil de energia, todas as temperaturas agrupadas por componente, e um feed de atividade com eventos reais (troca de perfil, driver carregado, alerta de temperatura, modo de ventoinha) | — |
| **Processador** | Uso, frequência, temperatura por núcleo (Intel `coretemp` ou AMD `k10temp`), potência real (RAPL, Intel ou AMD), modelo detectado | ✅ governor de CPU, boost de frequência (Turbo Boost/Precision Boost), limites de potência PL1/PL2 |
| **Gráficos** | GPU integrada e dedicada — classificadas pelo barramento PCI (não pelo nome do fabricante, então funciona igual em APU AMD); uso/VRAM/temperatura/potência via NVML (NVIDIA) ou sysfs `amdgpu` (AMD) | — |
| **Memória** | Uso de RAM e swap ao vivo, tabela de processos ordenada por consumo | ✅ limitar memória de um processo já em execução (cgroups) |
| **Bateria** | Percentual, ciclos, saúde, tempo restante | ✅ limite de carga (80%), calibração, carregamento via USB no hardware suportado |
| **Armazenamento** | Discos, uso e temperatura **por disco físico** (soma real das partições montadas em cada um, nunca o mesmo número pra todos), suporte a NVMe e SATA/HD (`drivetemp`) | ✅ checar SMART (saúde + desgaste) sob demanda, executar TRIM por partição |
| **Ventoinhas** | RPM real; controle manual com piso de segurança, volta automática se o app cair | ✅ via WMI da Acer (`linuwu_sense`) **ou** via `hwmon` pwm padrão do kernel (nct6775/it87/`dell-smm-hwmon` — não depende de fabricante) |
| **Energia** | Perfil ativo (Economia/Equilibrado/Desempenho) | ✅ troca real via `power-profiles-daemon` |
| **Processos** | Lista por CPU/memória em tempo real | ✅ encerrar processo, limitar memória de um já em execução, abrir programa novo com teto de memória/CPU e GPU dedicada (PRIME offload) |
| **Extras** | Recursos do driver Acer (luz do teclado, som de boot, LCD override) | ✅ no hardware suportado |
| **Configurações** | Cor de destaque, status do modelo detectado, instalação do driver, ativação de controles em modelo não validado | ✅ |

## Em quais sistemas e PCs funciona

**Formatos de instalação** (baixe em [Releases](../../releases)):

| Formato | Cobre | Instala sozinho o driver/watchdog/autostart? |
|---|---|---|
| `.deb` | Debian, Ubuntu, Parrot OS, Mint, Pop!_OS e derivados | ✅ |
| `.rpm` | Fedora, openSUSE, RHEL e derivados | ✅ |
| `AppImage` | **Qualquer distro Linux** com glibc — Arch, Manjaro, NixOS, Void, etc. Não precisa instalar nada, roda direto | ❌ (é só o executável; sem privilégio pra provisionar systemd/driver) |

**Por hardware:**

| Hardware | Monitoramento | Controle |
|---|---|---|
| **Qualquer CPU/PC Linux** (Intel ou AMD, notebook ou desktop, com ou sem bateria) | ✅ CPU, memória, disco (por unidade física), temperaturas, processos | ✅ governor de CPU, perfil de energia, limitar memória de processo, SMART/TRIM em qualquer disco — tudo genérico, sem driver de terceiros |
| **Intel** (Turbo Boost, RAPL) | ✅ | ✅ boost de frequência e limites de potência PL1/PL2 |
| **AMD** (Precision Boost, RAPL em kernel 6.11+) | ✅ `k10temp` | ✅ boost via `cpufreq/boost`, limites de potência quando o kernel expõe RAPL pra AMD |
| **NVIDIA** (com driver instalado) | ✅ uso/VRAM/temperatura/potência via NVML | ✅ escolher GPU dedicada por aplicativo (PRIME offload) |
| **AMD Radeon** (integrada ou dedicada, driver `amdgpu`) | ✅ uso/VRAM/temperatura/potência via sysfs do próprio driver | — |
| **Qualquer placa com chip hwmon pwm** (nct6775, it87, `dell-smm-hwmon`) | ✅ RPM | ✅ controle manual de ventoinha |
| **Qualquer disco NVMe ou SATA/SAS** | ✅ temperatura (`nvme`/`drivetemp`), uso real por partição | ✅ SMART (saúde + % de desgaste) e TRIM, ambos sob demanda com sua senha |
| **Acer Nitro ANV15-52** (modelo de referência) | ✅ tudo | ✅ tudo, automático desde a instalação |
| **Outro Acer Nitro/Predator** com WMI compatível | ✅ tudo | ✅ ventoinha/bateria/extras, mas exige confirmação explícita na tela (não validamos esse modelo exato) |
| **Dell, Lenovo, Asus, HP** | ✅ tudo que é genérico (CPU/GPU/disco/memória/processos) | ⚠️ parcial — ventoinha via hwmon quando o chip suportar. Cada fabricante ainda tem seu próprio mecanismo de EC (`thinkpad_acpi`, `asus-wmi`, `hp-wmi`) não implementado, porque exigiria validação em hardware real que não temos |

## Instalação

**Debian/Ubuntu/Parrot:**
```bash
sudo apt install ./NitroDeck-Linux_0.1.0_amd64.deb
```

**Fedora/openSUSE:**
```bash
sudo dnf install ./NitroDeck-Linux-0.1.0-1.x86_64.rpm
```

**Qualquer outra distro (AppImage, sem instalar):**
```bash
chmod +x "NitroDeck Linux_0.1.0_amd64.AppImage"
./"NitroDeck Linux_0.1.0_amd64.AppImage"
```

O `.deb`/`.rpm` já deixam tudo pronto sozinhos:
- Ícone no menu de aplicativos
- Comando `nitrodeck` no terminal (abre em segundo plano, devolve o prompt na hora — igual `code`)
- Abre automaticamente no login
- Serviço de segurança das ventoinhas rodando em segundo plano desde a instalação
- No Acer Nitro ANV15-52: driver de hardware instalado e controles liberados automaticamente

### Compilar do zero

```bash
git clone https://github.com/DaviSantosdonato/NitroDeck-LINUX.git
cd NitroDeck-LINUX
npm install
npm run tauri build -- --bundles deb,rpm,appimage
```

Requer Node.js, Rust (`cargo`) e as dependências de sistema do Tauri ([guia oficial](https://v2.tauri.app/start/prerequisites/)). Pra compilar o driver de hardware junto (opcional, só relevante em Acer Nitro/Predator), também precisa de `dkms` e os headers do seu kernel instalados. Pra gerar `.rpm`, precisa do pacote `rpm` instalado mesmo em distros baseadas em Debian.

## Por que confiar nele

- **Nunca roda como root.** A janela é sempre um processo normal do seu usuário. Os poucos ajustes que exigem root pedem sua senha via `pkexec` a cada uso — nunca de forma silenciosa, nunca com sudoers sem senha.
- **Nunca inventa leitura.** Se um sensor não existe ou não responde, a tela mostra "indisponível" — nunca um zero ou um valor de exemplo disfarçado de dado real.
- **Controle de hardware é opt-in por modelo.** Ventoinha, bateria e extras da Acer só ficam ativos automaticamente no modelo exato que validamos (Nitro ANV15-52). Em outro Acer Nitro/Predator com o mesmo driver, o app mostra um aviso claro e só libera se você confirmar explicitamente que quer usar por sua conta — nunca por padrão.
- **Ventoinha tem rede de segurança dupla.** Fechar o app tenta voltar pro automático; se travar, um serviço systemd independente força um piso seguro sozinho em poucos segundos — mesmo com o app fechado ou crashado.
- **Escrita de hardware nunca escala privilégio à toa.** Ventoinha/bateria/extras da Acer usam o grupo suplementar do driver via `sg`; limite de memória de processo usa a delegação de cgroups que o próprio systemd já dá à sua sessão — nenhum dos dois precisa de root.
- **Nada de reverse engineering às cegas.** Todo controle de hardware usa uma interface documentada (kernel `hwmon`, `power-profiles-daemon`, RAPL) ou um driver de comunidade já validado por terceiros (Linuwu-Sense) — nunca código escrito adivinhando comportamento de firmware não documentado.

## Desempenho e tamanho

O binário Rust é compilado com LTO, um único codegen-unit, `strip` de símbolos e `opt-level = "z"` (otimizado pra tamanho) — o `.deb` fica em torno de 2 MB, o app abre quase instantaneamente e o consumo de RAM em repouso é mínimo (é uma janela nativa Tauri/WebKitGTK, não Electron/Chromium). O AppImage é maior (~100 MB) porque empacota o runtime GTK inteiro junto, pra rodar em qualquer distro sem depender do que já está instalado — é assim que o formato AppImage funciona, não um problema deste app específico.

## Arquitetura

```
crates/nitrodeck-core/      # Tipos compartilhados (espelham src/types/hardware.ts)
crates/nitrodeck-hardware/  # Leitura/escrita real de hardware (procfs/sysfs/comandos)
src-tauri/                  # Shell Tauri, comandos expostos ao frontend
src/                        # React + TypeScript + Tailwind
driver/linuwu-sense/        # Fork do driver da Acer (DKMS), com créditos ao projeto original
packaging/                  # Scripts e unidades systemd empacotados no .deb/.rpm
```

## Licença

Ainda não definida para o código deste repositório — se for redistribuir, confirme com o autor antes. O driver em `driver/linuwu-sense/` é GPL-3.0 (herdada do projeto original, ver `LICENSE` nesse diretório).
