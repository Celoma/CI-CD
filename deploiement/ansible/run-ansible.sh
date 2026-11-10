#!/usr/bin/env bash
# Lance une commande Ansible dans le conteneur souverainrecrut-ansible.
#   ./run-ansible.sh ansible-playbook -i inventories/staging playbook.yml
#   ./run-ansible.sh ansible-playbook -i inventories/staging deploy.yml -e image_tag=1.0.0-05b02ac
# Prérequis : clé ~/.ssh/souverainrecrut_deploy et fichier .vault_pass (hors Git)
set -euo pipefail
cd "$(dirname "$0")"
IMAGE=souverainrecrut-ansible:2.17
docker image inspect "$IMAGE" >/dev/null 2>&1 || docker build -q -t "$IMAGE" .
# Copie du dossier dans le conteneur : Ansible ignore un ansible.cfg situé
# dans un dossier accessible en écriture à tous (cas des montages Windows)
MSYS_NO_PATHCONV=1 docker run --rm -i \
  -v "$(cygpath -w "$PWD" 2>/dev/null || pwd):/src:ro" \
  -v "$(cygpath -w "$PWD/../deployment" 2>/dev/null || echo "$PWD/../deployment"):/deployment:ro" \
  -v "$(cygpath -w "$HOME/.ssh/souverainrecrut_deploy" 2>/dev/null || echo "$HOME/.ssh/souverainrecrut_deploy"):/keys/id:ro" \
  "$IMAGE" sh -c 'mkdir -p ~/.ssh /work && install -m 600 /keys/id ~/.ssh/id_ed25519 \
    && cp -r /src/. /work/ansible && cp -r /deployment /work/deployment && chmod 755 /work/ansible \
    && { [ ! -f /work/ansible/.vault_pass ] || chmod 600 /work/ansible/.vault_pass; } \
    && cd /work/ansible && "$@"' sh "$@"
