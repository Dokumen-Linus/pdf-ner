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

POLICY_DOCUMENT_FILE="${SCRIPT_DIR}/dokumen-dev-web-api-policy.json"

echo "Creating or updating development web/API policy ${DEV_WEB_API_POLICY_NAME}"
policy_arn="$(ensure_policy "$DEV_WEB_API_POLICY_NAME" "file://${POLICY_DOCUMENT_FILE}")"
echo "Development web/API policy is ready: ${policy_arn}"
