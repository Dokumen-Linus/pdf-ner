#!/usr/bin/env bash
set -euo pipefail

: "${OWNER_ROLE_PASSWORD:?OWNER_ROLE_PASSWORD is required}"

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

if ! command -v dbmate >/dev/null 2>&1; then
  echo "ERROR: dbmate is required. Install dbmate before running local migrations." >&2
  exit 1
fi

echo "Running Better Auth setup against ${POSTGRES_DB}..."
echo "NOTE: This is a one-time setup block. If it fails because auth tables or indexes already exist,"
echo "      comment out the block between BEGIN ONE-TIME BETTER AUTH SETUP and END ONE-TIME BETTER AUTH SETUP,"
echo "      then rerun this script."
# BEGIN ONE-TIME BETTER AUTH SETUP
psql -v ON_ERROR_STOP=1 \
  "${psql_args[@]}" \
  -f "${DB_DIR}/migrations/better-auth/setup.sql"
# END ONE-TIME BETTER AUTH SETUP

echo "Running dbmate migrations as owner_role..."
DATABASE_URL="postgres://owner_role:${OWNER_ROLE_PASSWORD}@/${POSTGRES_DB}?host=${PGHOST}&port=${PGPORT}&sslmode=disable" \
  dbmate --migrations-dir="${DB_DIR}/migrations" up

echo "Running seed SQL files..."
for file in "${DB_DIR}"/seeds/*.sql; do
  [ -f "$file" ] || continue
  echo "Executing ${file}"
  psql -v ON_ERROR_STOP=1 \
    "${psql_args[@]}" \
    -f "$file"
done

echo "Running standard entity type seed SQL files..."
for file in "${DB_DIR}"/seeds/standard_entity_types/*.sql; do
  [ -f "$file" ] || continue
  echo "Executing ${file}"
  psql -v ON_ERROR_STOP=1 \
    "${psql_args[@]}" \
    -f "$file"
done
