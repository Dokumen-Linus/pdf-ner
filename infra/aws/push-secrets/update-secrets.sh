#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
SECRET_DRAFT_DIR="${SECRET_DRAFT_DIR:-${SCRIPT_DIR}/local-secrets}"

# shellcheck source=infra/aws/shared/common.sh
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/../shared/common.sh"

load_env_file "$LOCAL_ENV_FILE"
configure_common_defaults
DRY_RUN="${DRY_RUN:-0}"
STAGE="${STAGE:-${SECRET_STAGE:-${SECRETS_STAGE:-PROD}}}"

case "${STAGE,,}" in
  dev)
    SECRET_STAGE="dev"
    ;;
  prod)
    SECRET_STAGE="prod"
    ;;
  *)
    echo "ERROR: STAGE must be DEV or PROD." >&2
    exit 1
    ;;
esac

validate_secret_file() {
  local file="$1"
  local path
  path="$(draft_path "$file")"

  if [ ! -f "$path" ]; then
    echo "ERROR: missing reviewed secret draft: $path" >&2
    return 1
  fi

  if ! jq -e 'type == "object"' "$path" >/dev/null; then
    echo "ERROR: $path must contain a JSON object." >&2
    return 1
  fi

  if jq -e '.. | strings | select(test("REPLACE|<your|YOUR_"))' "$path" >/dev/null; then
    echo "ERROR: $path still contains placeholder values." >&2
    return 1
  fi
}

secret_exists() {
  local secret_name="$1"
  aws_region secretsmanager describe-secret --secret-id "$secret_name" >/dev/null 2>&1
}

if [ ! -d "$SECRET_DRAFT_DIR" ]; then
  echo "ERROR: secret draft directory not found: $SECRET_DRAFT_DIR" >&2
  echo "Create and review the local secret drafts before running this script." >&2
  exit 1
fi

FILES=(
  "${SECRET_STAGE}-web.json"
  "${SECRET_STAGE}-email.json"
  "${SECRET_STAGE}-api.json"
  "${SECRET_STAGE}-workers.json"
  "${SECRET_STAGE}-runpod.json"
)

NAMES=(
  "${SECRET_STAGE}/web"
  "${SECRET_STAGE}/email"
  "${SECRET_STAGE}/api"
  "${SECRET_STAGE}/workers"
  "${SECRET_STAGE}/runpod"
)

echo "Validating local secret drafts in: $SECRET_DRAFT_DIR"
for file in "${FILES[@]}"; do
  validate_secret_file "$file"
done

missing=()
for secret_name in "${NAMES[@]}"; do
  if ! secret_exists "$secret_name"; then
    missing+=("$secret_name")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "ERROR: refusing to update secrets because these are missing:" >&2
  printf '  %s\n' "${missing[@]}" >&2
  echo "This script is update-only; create missing secrets with create-secrets.sh first." >&2
  exit 1
fi

echo "Secrets to update in $AWS_REGION:"
for index in "${!FILES[@]}"; do
  echo "  ${NAMES[$index]} <= $(draft_path "${FILES[$index]}")"
done

if [ "$DRY_RUN" = "1" ]; then
  echo "DRY_RUN=1, no AWS secrets updated."
  exit 0
fi

for index in "${!FILES[@]}"; do
  aws_region secretsmanager put-secret-value \
    --secret-id "${NAMES[$index]}" \
    --secret-string "file://$(draft_path "${FILES[$index]}")" >/dev/null
  echo "Updated ${NAMES[$index]}"
done

echo "Secrets Manager update complete."
