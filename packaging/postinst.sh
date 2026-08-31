#!/bin/bash
# Executado pelo gerenciador de pacotes (dpkg/.deb ou rpm/.rpm) depois de
# desempacotar. Ativa as partes que
# "colam" o NitroDeck no sistema: comando de terminal, abrir sozinho no
# login, e o watchdog de segurança das ventoinhas (que só age em hardware
# confirmado — em qualquer outro PC ele fica parado sem fazer nada).
set -e

chmod +x /usr/lib/nitrodeck/nitrodeck-fan-watchdog.sh 2>/dev/null || true
chmod +x /usr/lib/nitrodeck/install-linuwu-sense.sh 2>/dev/null || true
chmod +x /usr/bin/nitrodeck 2>/dev/null || true

# Instala e carrega o driver linuwu_sense automaticamente só no modelo que
# validamos de verdade (Nitro ANV15-52). Em qualquer outro hardware, mesmo
# outro Acer Nitro/Predator, isso fica como ação explícita dentro do próprio
# app (tela de Configurações) — nunca acontece silenciosamente na instalação
# de um modelo que não testamos.
MODEL=$(cat /sys/class/dmi/id/product_name 2>/dev/null || echo "")
if [ "$MODEL" = "Nitro ANV15-52" ] && command -v dkms > /dev/null 2>&1; then
  FIRST_USER=$(loginctl list-sessions --no-legend 2>/dev/null | awk '{print $2}' | sort -u | head -1 | xargs -r id -nu 2>/dev/null)
  if [ -n "$FIRST_USER" ]; then
    /usr/lib/nitrodeck/install-linuwu-sense.sh "$FIRST_USER" || echo "NitroDeck: driver linuwu_sense não pôde ser instalado automaticamente (veja acima) — o app continua funcionando só como monitoramento." >&2
  fi
fi

if command -v systemctl > /dev/null 2>&1; then
  systemctl --global enable nitrodeck-fan-watchdog.service > /dev/null 2>&1 || true

  # Melhor esforço: se já tem um usuário com sessão gráfica ativa agora
  # (instalação manual, não um provisionamento automatizado), inicia o
  # serviço pra essa sessão na hora, sem esperar o próximo login.
  for uid in $(loginctl list-sessions --no-legend 2>/dev/null | awk '{print $2}' | sort -u); do
    user=$(id -nu "$uid" 2>/dev/null) || continue
    [ -n "$user" ] || continue
    runuser -l "$user" -c 'systemctl --user start nitrodeck-fan-watchdog.service' > /dev/null 2>&1 || true
  done
fi

exit 0
