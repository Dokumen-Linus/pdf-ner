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

: "${FIRST_NAME:?Set FIRST_NAME for the Identity Center user.}"
: "${LAST_NAME:?Set LAST_NAME for the Identity Center user.}"
: "${USER_EMAIL:?Set USER_EMAIL for the Identity Center user.}"

DEV_SSO_USER_NAME="${DEV_SSO_USER_NAME:-dokudev-${FIRST_NAME}}"

echo "Configuring development Identity Center user ${DEV_SSO_USER_NAME}"
group_id="$(ensure_group "$DEV_SSO_GROUP_NAME")"
user_id="$(ensure_user "$DEV_SSO_USER_NAME" "$FIRST_NAME" "$LAST_NAME" "$USER_EMAIL")"
ensure_group_membership "$group_id" "$user_id"

cat <<EOF
Development Identity Center user is ready.

AWS CLI-created Identity Center users do not automatically receive the console's
"Send email verification link" email. AWS documents two supported next steps:

1. In the IAM Identity Center console, open Users, select ${DEV_SSO_USER_NAME}, and choose Send email verification link or Reset password.
2. To make API/CLI-created users receive a verification email after their first sign-in attempt, enable Settings > Authentication > Standard authentication > Send email OTP.
EOF
