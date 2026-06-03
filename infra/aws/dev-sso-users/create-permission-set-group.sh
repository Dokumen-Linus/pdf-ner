#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/aws/shared/common.sh
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/../shared/common.sh"
# shellcheck source=infra/aws/dev-sso-users/lib.sh
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/lib.sh"

load_env_file "${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
configure_dev_sso_defaults
resolve_identity_center_instance

target_account_id="$(resolve_target_account_id)"

echo "Configuring development Identity Center access for ${PROJECT_NAME} in ${AWS_REGION}"
require_expected_local_iam_policies_exist
permission_set_arn="$(ensure_clean_permission_set "$DEV_SSO_PERMISSION_SET_NAME" "$DEV_SECRETS_POLICY_NAME" "$DEV_WEB_API_POLICY_NAME")"
ensure_customer_managed_policy_attached "$permission_set_arn" "$DEV_SECRETS_POLICY_NAME"
ensure_customer_managed_policy_attached "$permission_set_arn" "$DEV_WEB_API_POLICY_NAME"

group_id="$(ensure_group "$DEV_SSO_GROUP_NAME")"
ensure_account_assignment "$permission_set_arn" "$group_id" "$target_account_id"
provision_permission_set "$permission_set_arn" "$target_account_id"

echo "Development permission set and group are ready."
