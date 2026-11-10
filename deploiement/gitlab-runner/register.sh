#!/usr/bin/env bash
# Enregistre le runner auprès de gitlab.com (une seule fois).
# Le jeton (glrt-...) est créé dans GitLab : Settings > CI/CD > Runners >
# New project runner (tag : souverainrecrut-local), ou via l'API.
#   RUNNER_TOKEN=glrt-xxxx ./register.sh
set -euo pipefail
: "${RUNNER_TOKEN:?RUNNER_TOKEN manquant}"
docker exec gitlab-runner gitlab-runner register --non-interactive \
  --url https://gitlab.com \
  --token "$RUNNER_TOKEN" \
  --executor docker \
  --docker-image souverainrecrut-ansible:2.17 \
  --docker-pull-policy if-not-present \
  --description "souverainrecrut-local"
docker exec gitlab-runner gitlab-runner verify 2>&1 | grep -q "is valid" && echo "Runner enregistré et valide"
