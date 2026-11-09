#!/usr/bin/env bash
# ======================================================
# Initialisation de SonarQube pour SouverainRecrut (idempotent)
#   1. remplace le mot de passe admin par défaut
#   2. crée le projet souverainrecrut-backend
#   3. crée le Quality Gate "SouverainRecrut" et l'associe au projet
#   4. déclare le webhook vers Jenkins (nécessaire à waitForQualityGate)
#   5. génère un token d'analyse et l'écrit dans jenkins/.env (SONAR_TOKEN)
#
# Usage (depuis integration-continue/sonar) : ./setup-sonarqube.sh [chemin/.env]
# ======================================================
set -euo pipefail

ENV_FILE="${1:-../jenkins/.env}"
SONAR_URL="${SONAR_URL:-http://localhost:9000}"
PROJECT_KEY="souverainrecrut-backend"
GATE="SouverainRecrut"

SONAR_ADMIN_PASSWORD="$(grep -E '^SONAR_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')"
AUTH="admin:${SONAR_ADMIN_PASSWORD}"

api() { # api <méthode> <chemin> [args curl...]
  local method="$1" path="$2"; shift 2
  curl -s -u "$AUTH" -X "$method" "${SONAR_URL}${path}" "$@"
}

echo "> Attente de SonarQube (${SONAR_URL})..."
until curl -s "${SONAR_URL}/api/system/status" | grep -q '"status":"UP"'; do sleep 5; done

echo "> 1. Mot de passe admin"
code=$(curl -s -o /dev/null -w '%{http_code}' -u admin:admin -X POST "${SONAR_URL}/api/users/change_password" \
  -d login=admin -d previousPassword=admin --data-urlencode "password=${SONAR_ADMIN_PASSWORD}")
[ "$code" = "204" ] && echo "  mot de passe modifié" || echo "  déjà modifié (HTTP $code)"

echo "> 2. Projet ${PROJECT_KEY}"
api POST /api/projects/create -d "project=${PROJECT_KEY}" --data-urlencode "name=SouverainRecrut Backend" >/dev/null

echo "> 3. Quality Gate ${GATE}"
api POST /api/qualitygates/create -d "name=${GATE}" >/dev/null
# metric:opérateur:seuil  (LT = inférieur à → échec ; GT = supérieur à → échec)
for condition in \
  "coverage:LT:80" \
  "new_coverage:LT:80" \
  "duplicated_lines_density:GT:3" \
  "new_duplicated_lines_density:GT:3" \
  "software_quality_security_rating:GT:1" \
  "new_software_quality_security_rating:GT:1" \
  "software_quality_reliability_rating:GT:1" \
  "new_software_quality_reliability_rating:GT:1" \
  "new_security_hotspots_reviewed:LT:100"; do
  IFS=: read -r metric op error <<<"$condition"
  api POST /api/qualitygates/create_condition -d "gateName=${GATE}" -d "metric=${metric}" -d "op=${op}" -d "error=${error}" >/dev/null
  echo "  condition ${metric} ${op} ${error}"
done
api POST /api/qualitygates/select -d "gateName=${GATE}" -d "projectKey=${PROJECT_KEY}" >/dev/null

echo "> 4. Webhook vers Jenkins"
if ! api GET /api/webhooks/list | grep -q 'sonarqube-webhook'; then
  api POST /api/webhooks/create -d name=jenkins -d "url=http://jenkins:8080/sonarqube-webhook/" >/dev/null
fi

echo "> 5. Token d'analyse pour Jenkins"
token=$(api POST /api/user_tokens/generate -d "name=jenkins-$(date +%Y%m%d%H%M%S)" -d type=GLOBAL_ANALYSIS_TOKEN \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')
case "$token" in
  sq*) sed -i.bak -E "s|^SONAR_TOKEN=.*|SONAR_TOKEN=${token}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
       echo "  token écrit dans ${ENV_FILE} (SONAR_TOKEN)";;
  *)   echo "  ERREUR : génération du token impossible" >&2; exit 1;;
esac

echo "> Terminé. Redémarrer Jenkins pour charger le token : docker compose up -d jenkins"
