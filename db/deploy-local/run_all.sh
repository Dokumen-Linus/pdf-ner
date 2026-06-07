#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PGDATA_DIR="${REPO_ROOT}/pgdata"
LOGFILE="${REPO_ROOT}/logfile"

export POSTGRES_USER="${POSTGRES_USER:-$(id -un)}"
export POSTGRES_DB="${POSTGRES_DB:-dokumen}"
export OWNER_ROLE_PASSWORD="${OWNER_ROLE_PASSWORD:-owner_pw}"
export AUTH_USER_PASSWORD="${AUTH_USER_PASSWORD:-auth_pw}"
export WEB_USER_PASSWORD="${WEB_USER_PASSWORD:-web_pw}"
export API_USER_PASSWORD="${API_USER_PASSWORD:-api_pw}"
export WORKERS_USER_PASSWORD="${WORKERS_USER_PASSWORD:-workers_pw}"
export PGHOST="${PGDATA_DIR}"
export PGPORT="${PGPORT:-5432}"

if ! command -v initdb >/dev/null 2>&1; then
  echo "ERROR: initdb is required to initialize ${PGDATA_DIR}." >&2
  exit 1
fi

if ! command -v pg_ctl >/dev/null 2>&1; then
  echo "ERROR: pg_ctl is required to run the local database." >&2
  exit 1
fi

if ! command -v createdb >/dev/null 2>&1; then
  echo "ERROR: createdb is required to create ${POSTGRES_DB}." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql is required to prepare ${POSTGRES_DB}." >&2
  exit 1
fi

if [[ ! -f "${PGDATA_DIR}/PG_VERSION" ]]; then
  echo "Initializing local PostgreSQL data directory at ${PGDATA_DIR}..."
  initdb -D "${PGDATA_DIR}"
fi

if pg_ctl -D "${PGDATA_DIR}" status >/dev/null 2>&1; then
  echo "Local PostgreSQL is already running from ${PGDATA_DIR}."
else
  echo "Starting local PostgreSQL from ${PGDATA_DIR}..."
  pg_ctl -D "${PGDATA_DIR}" -l "${LOGFILE}" -o "-k ${PGHOST} -p ${PGPORT} -h ''" -w start
fi

echo "Ensuring database ${POSTGRES_DB} exists..."
psql_args=(
  --host "${PGHOST}"
  --port "${PGPORT}"
  --username "${POSTGRES_USER}"
)

if ! psql -v ON_ERROR_STOP=1 \
  "${psql_args[@]}" \
  --dbname postgres \
  --tuples-only \
  --no-align \
  --set=POSTGRES_DB="${POSTGRES_DB}" \
  --command "SELECT 1 FROM pg_database WHERE datname = :'POSTGRES_DB'" | grep -qx 1; then
  createdb \
    "${psql_args[@]}" \
    "${POSTGRES_DB}"
fi

bash "${SCRIPT_DIR}/01_roles.sh"
bash "${SCRIPT_DIR}/02_migrate.sh"

echo "Local database ${POSTGRES_DB} is ready."
