#!/usr/bin/env bash
# Source de données Terraform "external" : attend que la VM ait obtenu
# une adresse IP du DHCP du réseau NAT de Workstation et la renvoie en JSON.
#   1. adresse MAC de la VM (ethernet0.generatedAddress dans le .vmx)
#   2. dernier bail DHCP correspondant dans vmnetdhcp.leases
#   3. à défaut, vmrun getGuestIPAddress (nécessite les VMware Tools)
# Entrée (stdin) : {"vmx": "...", "vmrun": "..."}  Sortie : {"ip": "..."}
set -euo pipefail
input=$(cat)
field() { printf '%s' "$input" | sed -E "s/.*\"$1\" *: *\"([^\"]*)\".*/\1/"; }
VMX=$(field vmx); VMRUN=$(field vmrun)
LEASES="${VMNET_LEASES:-/c/ProgramData/VMware/vmnetdhcp.leases}"
is_ip() { [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; }

for _ in $(seq 1 60); do
  mac=$(sed -nE 's/^ethernet0\.generatedAddress = "([^"]+)"/\1/p' "$VMX" | tr 'A-F' 'a-f')
  if [ -n "$mac" ] && [ -f "$LEASES" ]; then
    ip=$(awk -v mac="$mac" '
      /^lease / { cur = $2 }
      /hardware ethernet/ { m = tolower($3); sub(/;$/, "", m); if (m == mac) last = cur }
      END { print last }' "$LEASES" | tr -d '\r')
    if is_ip "$ip"; then printf '{"ip":"%s"}\n' "$ip"; exit 0; fi
  fi
  ip=$(MSYS_NO_PATHCONV=1 "$VMRUN" -T ws getGuestIPAddress "$(cygpath -w "$VMX")" 2>/dev/null | tr -d '\r' || true)
  if is_ip "$ip"; then printf '{"ip":"%s"}\n' "$ip"; exit 0; fi
  sleep 5
done
echo "Adresse IP introuvable pour $VMX" >&2
exit 1
