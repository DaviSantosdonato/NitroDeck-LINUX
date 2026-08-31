#!/bin/bash
# Executado pelo dpkg ao remover o pacote. Só desfaz o que o postinst fez
# (não mexe em nada relacionado ao driver linuwu_sense, que é externo ao
# NitroDeck e não deve ser removido junto).
set -e

case "$1" in
  remove|purge)
    if command -v systemctl > /dev/null 2>&1; then
      systemctl --global disable nitrodeck-fan-watchdog.service > /dev/null 2>&1 || true
      for uid in $(loginctl list-sessions --no-legend 2>/dev/null | awk '{print $2}' | sort -u); do
        user=$(id -nu "$uid" 2>/dev/null) || continue
        [ -n "$user" ] || continue
        runuser -l "$user" -c 'systemctl --user stop nitrodeck-fan-watchdog.service' > /dev/null 2>&1 || true
      done
    fi
    ;;
esac

exit 0
