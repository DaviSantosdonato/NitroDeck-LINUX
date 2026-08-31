#!/bin/bash
# Constrói e instala o driver linuwu_sense via DKMS (sobrevive a upgrades de
# kernel, ao contrário de um `make install` manual). Chamado como root
# (postinst do pacote, no modelo confirmado; ou via pkexec a partir do
# próprio app, com consentimento explícito na tela, em outros modelos).
#
# Uso: install-linuwu-sense.sh <usuario-que-vai-usar-o-app>
set -e

TARGET_USER="${1:-}"
if [ -z "$TARGET_USER" ]; then
  echo "Uso: $0 <usuario>" >&2
  exit 1
fi

PKG_NAME="nitrodeck-linuwu-sense"
PKG_VER="1.0.0"
MODEL=$(cat /sys/class/dmi/id/product_name 2>/dev/null || echo "")
KVER=$(uname -r)

if [ ! -d "/lib/modules/$KVER/build" ]; then
  echo "Cabeçalhos do kernel ($KVER) não encontrados — instale linux-headers-$KVER (ou o pacote de headers equivalente da sua distro) antes de tentar de novo." >&2
  exit 1
fi

if ! command -v dkms > /dev/null 2>&1; then
  echo "dkms não está instalado (pacote 'dkms')." >&2
  exit 1
fi

if [ ! -d "/var/lib/dkms/$PKG_NAME/$PKG_VER" ]; then
  dkms add -m "$PKG_NAME" -v "$PKG_VER"
fi
dkms install -m "$PKG_NAME" -v "$PKG_VER" -k "$KVER" --force

# Só forçamos o parâmetro nitro_v4 no modelo que validamos de verdade — em
# qualquer outro, confiamos na detecção por DMI do próprio driver (a tabela
# dele já cobre vários Nitro/Predator; forçar isso às cegas em modelo
# diferente pode selecionar o conjunto de comandos errado).
mkdir -p /etc/modprobe.d
if [ "$MODEL" = "Nitro ANV15-52" ]; then
  echo "options linuwu_sense nitro_v4=1" > /etc/modprobe.d/nitrodeck-linuwu-sense.conf
else
  rm -f /etc/modprobe.d/nitrodeck-linuwu-sense.conf
fi

echo "blacklist acer_wmi" > /etc/modprobe.d/nitrodeck-blacklist-acer-wmi.conf
modprobe -r acer_wmi 2>/dev/null || true
modprobe -r linuwu_sense 2>/dev/null || true
modprobe linuwu_sense

echo "linuwu_sense" > /etc/modules-load.d/nitrodeck-linuwu-sense.conf

if command -v systemctl > /dev/null 2>&1; then
  install -m 644 /usr/share/nitrodeck/linuwu-sense-shutdown.service /etc/systemd/system/ 2>/dev/null || true
  systemctl daemon-reload 2>/dev/null || true
  systemctl enable linuwu-sense-shutdown.service > /dev/null 2>&1 || true
fi

getent group linuwu_sense > /dev/null 2>&1 || groupadd linuwu_sense
usermod -aG linuwu_sense "$TARGET_USER"

sleep 2
MODEL_DIR=$(ls "/sys/module/linuwu_sense/drivers/platform:acer-wmi/acer-wmi/" 2>/dev/null | grep -E 'nitro_sense|predator_sense' || true)
if [ -n "$MODEL_DIR" ]; then
  CONF=/etc/tmpfiles.d/nitrodeck-linuwu-sense.conf
  : > "$CONF"
  if echo "$MODEL_DIR" | grep -q nitro_sense; then
    FIELDS="fan_speed battery_limiter battery_calibration usb_charging"
  else
    FIELDS="backlight_timeout battery_calibration battery_limiter boot_animation_sound fan_speed lcd_override usb_charging"
  fi
  for f in $FIELDS; do
    path="/sys/module/linuwu_sense/drivers/platform:acer-wmi/acer-wmi/$MODEL_DIR/$f"
    [ -e "$path" ] || continue
    echo "f $path 0660 root linuwu_sense" >> "$CONF"
  done
  systemd-tmpfiles --create "$CONF" > /dev/null 2>&1 || true
  echo "OK: driver instalado e configurado (diretório detectado: $MODEL_DIR)."
else
  echo "AVISO: o módulo carregou, mas não encontramos nitro_sense/predator_sense no sysfs — este hardware pode não ser suportado pelo driver." >&2
fi
