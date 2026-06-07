#!/usr/bin/env bash
set -euo pipefail

: "${OWNER_ROLE_PASSWORD:?OWNER_ROLE_PASSWORD is required}"
: "${WEB_USER_PASSWORD:?WEB_USER_PASSWORD is required}"
: "${API_USER_PASSWORD:?API_USER_PASSWORD is required}"
: "${WORKERS_USER_PASSWORD:?WORKERS_USER_PASSWORD is required}"
: "${AUTH_USER_PASSWORD:?AUTH_USER_PASSWORD is required}"

POSTGRES_USER="${POSTGRES_USER:-$(id -un)}"
POSTGRES_DB="${POSTGRES_DB:-dokumen}"
PGHOST="${PGHOST:-}"
PGPORT="${PGPORT:-5432}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

psql_args=(
  --port "$PGPORT"
  --username "$POSTGRES_USER"
  --dbname "$POSTGRES_DB"
)
if [[ -n "$PGHOST" ]]; then
  psql_args=(--host "$PGHOST" "${psql_args[@]}")
fi

echo "Creating roles, schemas, and grants in ${POSTGRES_DB}..."
psql -v ON_ERROR_STOP=1 \
  "${psql_args[@]}" \
  --set=OWNER_ROLE_PASSWORD="$OWNER_ROLE_PASSWORD" \
  --set=WEB_USER_PASSWORD="$WEB_USER_PASSWORD" \
  --set=API_USER_PASSWORD="$API_USER_PASSWORD" \
  --set=WORKERS_USER_PASSWORD="$WORKERS_USER_PASSWORD" \
  --set=AUTH_USER_PASSWORD="$AUTH_USER_PASSWORD" \
  -f "$DB_DIR/bootstrap.sql"
