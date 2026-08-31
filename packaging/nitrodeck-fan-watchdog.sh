#!/bin/bash
# Mantém as ventoinhas num piso seguro (25% CPU/GPU) sempre que o app
# NitroDeck não estiver aberto — inclusive logo no login, sem precisar abrir
# a interface. Quando o app está rodando, ele quem manda: este script não
# escreve nada, só observa. Isso também cobre o caso de o app travar em modo
# manual (crash, kill -9): dentro de poucos segundos o piso volta a valer.
#
# Só age em hardware confirmado (mesma checagem que o app Rust faz em
# model::is_confirmed) — em qualquer outro notebook, mesmo que por acaso
# tenha o mesmo driver linuwu_sense carregado, este script fica parado.
set -u

CONFIRMED_MODEL="Nitro ANV15-52"
FAN_FILE="/sys/module/linuwu_sense/drivers/platform:acer-wmi/acer-wmi/nitro_sense/fan_speed"
BASELINE="25,25"
INTERVAL=5

is_confirmed_model() {
  [ "$(cat /sys/class/dmi/id/product_name 2>/dev/null)" = "$CONFIRMED_MODEL" ]
}

while true; do
  if is_confirmed_model && [ -f "$FAN_FILE" ] && ! pgrep -x nitrodeck-linux > /dev/null 2>&1; then
    value=$(sg linuwu_sense -c "cat '$FAN_FILE'" 2>/dev/null | tr -d '[:space:]')
    if [ -n "$value" ] && [ "$value" != "$BASELINE" ]; then
      logger -t nitrodeck-fan-watchdog "App fechado e ventoinha em '$value' — aplicando piso de segurança $BASELINE."
      sg linuwu_sense -c "echo '$BASELINE' > '$FAN_FILE'" 2>/dev/null
    fi
  fi
  sleep "$INTERVAL"
done
