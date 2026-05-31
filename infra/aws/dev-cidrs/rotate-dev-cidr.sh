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
validate_dev_cidr_rotation_inputs

if [ "$PREVIOUS_DEV_CIDR" = "$DEV_CIDR" ] && [ "$PREVIOUS_DEV_IPV6_CIDR" = "$DEV_IPV6_CIDR" ]; then
  echo "Previous and new development CIDRs are unchanged; nothing to rotate."
  exit 0
fi

DEV_RDS_SECURITY_GROUP_ID="$(resolve_dev_rds_security_group_id)"

echo "Rotating development CIDR access for ${PROJECT_NAME} in ${AWS_REGION}"
rotate_dev_db_cidrs "$DEV_RDS_SECURITY_GROUP_ID" "$RDS_PORT"
rotate_dev_secrets_policy_cidrs
echo "Development CIDR rotate complete."
