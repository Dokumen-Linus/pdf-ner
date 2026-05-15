#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/infra/docker-compose.yml"

export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_DB="${POSTGRES_DB:-dokumen}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-dokumen}"
export OWNER_ROLE_PASSWORD="${OWNER_ROLE_PASSWORD:-owner_pw}"
export AUTH_ROLE_PASSWORD="${AUTH_ROLE_PASSWORD:-auth_pw}"
export WEB_USER_PASSWORD="${WEB_USER_PASSWORD:-web_pw}"
export API_USER_PASSWORD="${API_USER_PASSWORD:-api_pw}"
export WORKERS_USER_PASSWORD="${WORKERS_USER_PASSWORD:-workers_pw}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is required to run the local database." >&2
  exit 1
fi

echo "Starting local PostgreSQL container..."
echo "Using ${COMPOSE_FILE}"

docker compose -f "${COMPOSE_FILE}" --profile local-db up -d --build db

container_id="$(docker compose -f "${COMPOSE_FILE}" --profile local-db ps -q db)"
if [[ -z "${container_id}" ]]; then
  echo "ERROR: db container was not created." >&2
  exit 1
fi

echo "Waiting for local PostgreSQL healthcheck..."
for _ in {1..60}; do
  status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' "${container_id}")"
  if [[ "${status}" == "healthy" ]]; then
    smoke_result="$(docker exec "${container_id}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Atc "SELECT to_regclass('auth.user') IS NOT NULL AND to_regclass('web.users') IS NOT NULL AND to_regclass('core.prompts') IS NOT NULL AND to_regclass('public.chat_models') IS NOT NULL AND to_regclass('public.std_entity_types') IS NOT NULL;")"
    if [[ "${smoke_result}" != "t" ]]; then
      echo "ERROR: local PostgreSQL is healthy, but expected app tables are missing. Recent logs:" >&2
      docker logs --tail 120 "${container_id}" >&2
      exit 1
    fi
    echo "Local PostgreSQL is healthy."
    echo "Schema smoke check passed."
    echo "Database: ${POSTGRES_DB}"
    echo "Admin user: ${POSTGRES_USER}"
    echo "Port: container-only unless you publish it in infra/docker-compose.yml"
    exit 0
  fi
  if [[ "${status}" == "unhealthy" ]]; then
    echo "ERROR: local PostgreSQL became unhealthy. Recent logs:" >&2
    docker logs --tail 80 "${container_id}" >&2
    exit 1
  fi
  sleep 2
done

echo "ERROR: timed out waiting for local PostgreSQL to become healthy. Recent logs:" >&2
docker logs --tail 80 "${container_id}" >&2
exit 1
