#!/usr/bin/env bash
set -euo pipefail

: "${RDS_HOST:?RDS_HOST is required}"
: "${RDS_ADMIN_USER:?RDS_ADMIN_USER is required}"
: "${PGPASSWORD:?PGPASSWORD must contain the RDS admin password}"
: "${OWNER_ROLE_PASSWORD:?OWNER_ROLE_PASSWORD is required}"
: "${AUTH_ROLE_PASSWORD:?AUTH_ROLE_PASSWORD is required}"
: "${WEB_USER_PASSWORD:?WEB_USER_PASSWORD is required}"
: "${API_USER_PASSWORD:?API_USER_PASSWORD is required}"
: "${WORKERS_USER_PASSWORD:?WORKERS_USER_PASSWORD is required}"

RDS_PORT="${RDS_PORT:-5432}"
RDS_DB="${RDS_DB:-dokumen}"
RDS_ADMIN_DB="${RDS_ADMIN_DB:-postgres}"
PGSSLMODE="${PGSSLMODE:-require}"
export PGPASSWORD PGSSLMODE

echo "Creating database ${RDS_DB} on ${RDS_HOST}:${RDS_PORT} if needed..."
psql -v ON_ERROR_STOP=1 \
  --host "$RDS_HOST" \
  --port "$RDS_PORT" \
  --username "$RDS_ADMIN_USER" \
  --dbname "$RDS_ADMIN_DB" \
  --set=RDS_DB="$RDS_DB" <<'EOSQL'
SELECT format('CREATE DATABASE %I', :'RDS_DB')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'RDS_DB'
)\gexec
EOSQL

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Creating roles, schemas, and grants in ${RDS_DB}..."
psql -v ON_ERROR_STOP=1 \
  --host "$RDS_HOST" \
  --port "$RDS_PORT" \
  --username "$RDS_ADMIN_USER" \
  --dbname "$RDS_DB" \
  --set=OWNER_ROLE_PASSWORD="$OWNER_ROLE_PASSWORD" \
  --set=AUTH_ROLE_PASSWORD="$AUTH_ROLE_PASSWORD" \
  --set=WEB_USER_PASSWORD="$WEB_USER_PASSWORD" \
  --set=API_USER_PASSWORD="$API_USER_PASSWORD" \
  --set=WORKERS_USER_PASSWORD="$WORKERS_USER_PASSWORD" \
  -f "$SCRIPT_DIR/roles_schemas.sql"
