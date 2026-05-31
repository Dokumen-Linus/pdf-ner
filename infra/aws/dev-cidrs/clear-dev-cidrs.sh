#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/aws/shared/common.sh
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/../shared/common.sh"
# shellcheck source=infra/aws/dev-cidrs/lib.sh
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/lib.sh"

load_env_file "${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
configure_dev_cidr_defaults
validate_dev_cidr_inputs

DEV_RDS_SECURITY_GROUP_ID="$(resolve_dev_rds_security_group_id)"

echo "Clearing development CIDRs for ${PROJECT_NAME} in ${AWS_REGION}"
clear_dev_db_cidrs "$DEV_RDS_SECURITY_GROUP_ID" "$RDS_PORT"
clear_dev_secrets_policy_cidrs
echo "Development CIDR clear complete."
