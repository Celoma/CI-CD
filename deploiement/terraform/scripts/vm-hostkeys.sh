#!/usr/bin/env bash
# Source de données Terraform "external" : relève les clés d'hôte SSH d'une VM
# (lignes known_hosts) pour que Ansible et GitLab vérifient l'identité des
# serveurs au lieu d'accepter n'importe quelle clé.
# Entrée (stdin) : {"ip": "..."}  Sortie : {"known_hosts": "..."}
set -euo pipefail
IP=$(cat | sed -E 's/.*"ip" *: *"([^"]*)".*/\1/')
for _ in $(seq 1 30); do
  keys=$(ssh-keyscan -T 5 -t ed25519,ecdsa "$IP" 2>/dev/null | grep -v '^#' | sort || true)
  if [ -n "$keys" ]; then
    # JSON : chaque fin de ligne est encodée en \n
    json=""
    while IFS= read -r line; do json+="${line}\\n"; done <<< "$keys"
    printf '{"known_hosts":"%s"}\n' "$json"
    exit 0
  fi
  sleep 5
done
echo "Impossible de relever les clés SSH de $IP" >&2
exit 1
