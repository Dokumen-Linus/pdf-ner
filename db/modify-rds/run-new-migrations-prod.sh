#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=db/modify-rds/lib.sh
. "${SCRIPT_DIR}/lib.sh"

if [ "$#" -ne 0 ]; then
  echo "Usage: bash db/modify-rds/run-new-migrations-prod.sh" >&2
  exit 1
fi

configure_modify_rds_paths
load_modify_rds_env production
configure_modify_rds_db_defaults
configure_prod_remote_defaults

require_cmd aws
require_cmd dbmate
require_cmd nc
require_cmd psql
require_no_duplicate_migration_versions
resolve_prod_instance_id
start_prod_port_forward
assert_local_dbmate_history production

echo "Checking ${RDS_ADMIN_USER} can SET ROLE owner_role on production RDS tunnel ${RDS_HOST}:${RDS_PORT}/${RDS_DB}..."
psql -v ON_ERROR_STOP=1 \
  --host "$RDS_HOST" \
  --port "$RDS_PORT" \
  --username "$RDS_ADMIN_USER" \
  --dbname "$RDS_DB" \
  --command "SET ROLE owner_role; SELECT current_user;" >/dev/null

echo "Running dbmate migrations against production RDS tunnel ${RDS_HOST}:${RDS_PORT}/${RDS_DB}..."
DATABASE_URL="postgres://${RDS_ADMIN_USER}@${RDS_HOST}:${RDS_PORT}/${RDS_DB}?sslmode=${PGSSLMODE}&options=-c%20role%3Downer_role" \
  dbmate --migrations-dir="${DB_DIR}/migrations" up
