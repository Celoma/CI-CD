#!/usr/bin/env bash
# Démarre (ou affiche) les VM staging et production dans VMware Workstation.
# Terraform ne démarre les VM qu'à leur création : après un redémarrage du
# poste, elles sont éteintes et ce script les relance.
#   ./scripts/vm-start.sh                 # toutes les VM, avec fenêtre
#   ./scripts/vm-start.sh production      # une seule VM
#   DISPLAY_MODE=nogui ./scripts/vm-start.sh
# Une VM déjà lancée en nogui n'a pas de fenêtre : l'ouvrir dans Workstation
# (File > Open > .vmx) affiche sa console sans l'arrêter.
set -euo pipefail
VMRUN="${VMRUN:-/c/Program Files (x86)/VMware/VMware Workstation/vmrun.exe}"
VM_DIR="${VM_DIR:-$HOME/Documents/Virtual Machines}"
MODE="${DISPLAY_MODE:-gui}"
vmrun() { MSYS_NO_PATHCONV=1 "$VMRUN" -T ws "$@"; }

for env in "${@:-staging production}"; do
  for e in $env; do
    vmx="$VM_DIR/souverainrecrut-$e/souverainrecrut-$e.vmx"
    [ -f "$vmx" ] || { echo "> $vmx introuvable (terraform apply ?)"; continue; }
    w=$(cygpath -w "$vmx")
    if vmrun list | tr -d '\r' | grep -Fxq "$w"; then
      echo "> souverainrecrut-$e tourne déjà"
    else
      echo "> Démarrage de souverainrecrut-$e ($MODE)"
      vmrun start "$w" "$MODE"
    fi
  done
done
