#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=db/modify-rds/lib.sh
. "${SCRIPT_DIR}/lib.sh"

if [ "$#" -ne 1 ]; then
  echo "Usage: bash db/modify-rds/run-new-seeds-prod.sh db/seeds/path/to-seed.sql" >&2
  exit 1
fi

SEED_FILE_ARG="$1"

configure_modify_rds_paths
assert_seed_file_arg "$SEED_FILE_ARG"
load_modify_rds_env production
configure_modify_rds_db_defaults
configure_prod_remote_defaults

require_cmd aws
require_cmd nc
require_cmd psql
resolve_prod_instance_id
start_prod_port_forward
assert_local_dbmate_history production

echo "Running seed ${SEED_FILE_ARG} against production RDS tunnel ${RDS_HOST}:${RDS_PORT}/${RDS_DB}..."
psql -v ON_ERROR_STOP=1 \
  --host "$RDS_HOST" \
  --port "$RDS_PORT" \
  --username "$RDS_ADMIN_USER" \
  --dbname "$RDS_DB" \
  -f "$SEED_FILE"
