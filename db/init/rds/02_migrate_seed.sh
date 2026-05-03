#!/usr/bin/env bash
set -euo pipefail

: "${RDS_HOST:?RDS_HOST is required}"
: "${RDS_ADMIN_USER:?RDS_ADMIN_USER is required}"
: "${PGPASSWORD:?PGPASSWORD must contain the RDS admin password}"
: "${OWNER_ROLE_PASSWORD:?OWNER_ROLE_PASSWORD is required}"

RDS_PORT="${RDS_PORT:-5432}"
RDS_DB="${RDS_DB:-dokumen}"
PGSSLMODE="${PGSSLMODE:-require}"
export PGPASSWORD PGSSLMODE

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if ! command -v dbmate >/dev/null 2>&1; then
  echo "ERROR: dbmate is required. Install dbmate before running RDS migrations." >&2
  exit 1
fi

echo "Running Better Auth setup against ${RDS_DB}..."
psql -v ON_ERROR_STOP=1 \
  --host "$RDS_HOST" \
  --port "$RDS_PORT" \
  --username "$RDS_ADMIN_USER" \
  --dbname "$RDS_DB" \
  -f "${DB_DIR}/migrations/better-auth/setup.sql"

echo "Running dbmate migrations as owner_role..."
DATABASE_URL="postgres://owner_role:${OWNER_ROLE_PASSWORD}@${RDS_HOST}:${RDS_PORT}/${RDS_DB}?sslmode=${PGSSLMODE}" \
  dbmate --migrations-dir="${DB_DIR}/migrations" up

echo "Running seed SQL files..."
for file in "${DB_DIR}"/seeds/*.sql; do
  [ -f "$file" ] || continue
  echo "Executing ${file}"
  psql -v ON_ERROR_STOP=1 \
    --host "$RDS_HOST" \
    --port "$RDS_PORT" \
    --username "$RDS_ADMIN_USER" \
    --dbname "$RDS_DB" \
    -f "$file"
done
