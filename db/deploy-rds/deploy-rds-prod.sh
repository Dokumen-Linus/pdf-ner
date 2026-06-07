#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODIFY_RDS_DIR="$(cd "${SCRIPT_DIR}/../modify-rds" && pwd)"
# shellcheck source=db/modify-rds/lib.sh
. "${MODIFY_RDS_DIR}/lib.sh"

ENV_FILE="${RDS_DEPLOY_ENV_FILE:-${SCRIPT_DIR}/.env.production}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Env file not found: ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

export ENV_FILE

configure_prod_remote_defaults

require_cmd aws
require_cmd nc
require_cmd psql
require_cmd dbmate
if [ "$USE_SSH_FALLBACK" != "1" ]; then
  require_cmd session-manager-plugin
fi
resolve_prod_instance_id
start_prod_port_forward
export RDS_HOST RDS_PORT

bash "${SCRIPT_DIR}/01_create_database_roles_schemas.sh"
bash "${SCRIPT_DIR}/02_migrate_and_seed.sh"
bash "${SCRIPT_DIR}/03_healthcheck.sh"
