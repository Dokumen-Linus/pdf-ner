#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/dokumen/pdf-ner}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-infra/.env.prod}"
SECRETS_STAGE="${SECRETS_STAGE:-prod}"
AWS_REGION="${AWS_REGION:-us-east-1}"

cd "$APP_DIR"

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

secret_value() {
  local secret_id="$1"
  local key="$2"
  aws secretsmanager get-secret-value \
    --region "$AWS_REGION" \
    --secret-id "$secret_id" \
    --query SecretString \
    --output text | jq -r --arg key "$key" '.[$key] // empty'
}

require_token() {
  local token="$1"
  local name="$2"
  if [[ -z "$token" || "$token" == "null" ]]; then
    echo "ERROR: ${name} HEALTHCHECK_TOKEN is missing" >&2
    exit 1
  fi
}

curl_ok() {
  local url="$1"
  shift
  curl --fail --silent --show-error --max-time 5 "$@" "$url" >/dev/null
}

echo "Checking compose services..."
compose ps

echo "Checking Redis..."
compose exec -T redis redis-cli ping | grep -qx PONG

WEB_TOKEN="$(secret_value "${SECRETS_STAGE}/web" HEALTHCHECK_TOKEN)"
API_TOKEN="$(secret_value "${SECRETS_STAGE}/api" HEALTHCHECK_TOKEN)"
require_token "$WEB_TOKEN" "web"
require_token "$API_TOKEN" "api"

echo "Checking web health endpoints..."
curl_ok "http://localhost:3000/api/healthz"
curl_ok "http://localhost:3000/api/readyz"
curl_ok "http://localhost:3000/api/readyz/details" -H "X-Health-Check-Token: ${WEB_TOKEN}"

echo "Checking API health endpoints..."
curl_ok "http://localhost:8000/healthz"
curl_ok "http://localhost:8000/readyz"
curl_ok "http://localhost:8000/readyz/details" -H "X-Health-Check-Token: ${API_TOKEN}"

echo "Checking worker health..."
compose exec -T worker python -m app.healthcheck --json

echo "EC2 health checks passed."
