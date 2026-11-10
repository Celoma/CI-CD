#!/usr/bin/env bash
# Crée une VM par clonage complet de la VM modèle, lui injecte sa
# configuration cloud-init (guestinfo) puis la démarre.
# Variables : VMRUN TEMPLATE_VMX VMX VM_NAME CPUS MEMORY METADATA USERDATA
#             DISPLAY_MODE (gui par défaut : fenêtre VMware ; nogui : arrière-plan)
set -euo pipefail
vmrun() { MSYS_NO_PATHCONV=1 "$VMRUN" -T ws "$@"; }
win() { cygpath -w "$1"; }

if [ -f "$VMX" ]; then
  echo "> $VM_NAME existe déjà ($VMX)"
else
  echo "> Clonage de la VM modèle -> $VM_NAME"
  vmrun clone "$(win "$TEMPLATE_VMX")" "$(win "$VMX")" full "-cloneName=$VM_NAME"
fi

echo "> Configuration : $CPUS vCPU, $MEMORY Mo, cloud-init via guestinfo"
sed -i -e '/^memsize/d' -e '/^numvcpus/d' -e '/^guestinfo\./d' "$VMX"
cat >> "$VMX" <<CONF
memsize = "$MEMORY"
numvcpus = "$CPUS"
guestinfo.metadata = "$METADATA"
guestinfo.metadata.encoding = "base64"
guestinfo.userdata = "$USERDATA"
guestinfo.userdata.encoding = "base64"
CONF

echo "> Démarrage de $VM_NAME (${DISPLAY_MODE:-gui})"
vmrun start "$(win "$VMX")" "${DISPLAY_MODE:-gui}"
