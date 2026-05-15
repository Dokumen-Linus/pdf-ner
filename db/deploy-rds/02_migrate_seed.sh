#!/usr/bin/env bash
set -euo pipefail

: "${RDS_HOST:?RDS_HOST is required}"
: "${RDS_ADMIN_USER:?RDS_ADMIN_USER is required}"
: "${PGPASSWORD:?PGPASSWORD must contain the RDS admin password}"

RDS_PORT="${RDS_PORT:-5432}"
RDS_DB="${RDS_DB:-dokumen}"
PGSSLMODE="${PGSSLMODE:-require}"
export PGPASSWORD PGSSLMODE

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if ! command -v dbmate >/dev/null 2>&1; then
  echo "ERROR: dbmate is required. Install dbmate before running RDS migrations." >&2
  exit 1
fi

# echo "Running Better Auth setup against ${RDS_DB}..."
# echo "BEGIN ONE-TIME SETUP BLOCK"
# psql -v ON_ERROR_STOP=1 \
#   --host "$RDS_HOST" \
#   --port "$RDS_PORT" \
#   --username "$RDS_ADMIN_USER" \
#   --dbname "$RDS_DB" \
#   -f "${DB_DIR}/migrations/better-auth/setup.sql"
# echo "END ONE-TIME SETUP BLOCK"

echo "Running dbmate migrations as owner_role..."
echo "Checking ${RDS_ADMIN_USER} can SET ROLE owner_role..."
psql -v ON_ERROR_STOP=1 \
  --host "$RDS_HOST" \
  --port "$RDS_PORT" \
  --username "$RDS_ADMIN_USER" \
  --dbname "$RDS_DB" \
  --command "SET ROLE owner_role; SELECT current_user;" >/dev/null

DATABASE_URL="postgres://${RDS_ADMIN_USER}@${RDS_HOST}:${RDS_PORT}/${RDS_DB}?sslmode=${PGSSLMODE}&options=-c%20role%3Downer_role" \
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

echo "Running standard entity type seed SQL files..."
for file in "${DB_DIR}"/seeds/standard_entity_types/*.sql; do
  [ -f "$file" ] || continue
  echo "Executing ${file}"
  psql -v ON_ERROR_STOP=1 \
    --host "$RDS_HOST" \
    --port "$RDS_PORT" \
    --username "$RDS_ADMIN_USER" \
    --dbname "$RDS_DB" \
    -f "$file"
done
