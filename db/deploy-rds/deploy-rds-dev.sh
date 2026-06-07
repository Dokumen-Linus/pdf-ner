#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${RDS_DEPLOY_ENV_FILE:-${SCRIPT_DIR}/.env.development}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Env file not found: ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

export ENV_FILE

bash "${SCRIPT_DIR}/01_create_database_roles_schemas.sh"
bash "${SCRIPT_DIR}/02_migrate_and_seed.sh"
bash "${SCRIPT_DIR}/03_healthcheck.sh"
