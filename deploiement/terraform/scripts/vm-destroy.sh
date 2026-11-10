#!/usr/bin/env bash
# Arrête puis supprime une VM (appelé par terraform destroy).
# Variables : VMRUN VMX
set -uo pipefail
vmrun() { MSYS_NO_PATHCONV=1 "$VMRUN" -T ws "$@"; }
[ -f "$VMX" ] || { echo "> $VMX absente, rien à supprimer"; exit 0; }
echo "> Arrêt et suppression de $VMX"
vmrun stop "$(cygpath -w "$VMX")" hard 2>/dev/null || true
vmrun deleteVM "$(cygpath -w "$VMX")"
