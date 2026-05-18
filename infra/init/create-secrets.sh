#!/usr/bin/env bash
# Create AWS Secrets Manager secrets from reviewed local draft JSON files.
# This script is intentionally create-only; it fails if any target secret exists.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
SECRET_DRAFT_DIR="${SECRET_DRAFT_DIR:-${SCRIPT_DIR}/local-secrets}"

if [ -f "$LOCAL_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$LOCAL_ENV_FILE"
  set +a
fi

AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="${PROJECT_NAME:-dokumen}"
DRY_RUN="${DRY_RUN:-0}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1" >&2
    exit 1
  fi
}

aws_region() {
  aws --region "$AWS_REGION" "$@"
}

draft_path() {
  printf '%s/%s' "$SECRET_DRAFT_DIR" "$1"
}

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

require_cmd aws
require_cmd jq

if [ ! -d "$SECRET_DRAFT_DIR" ]; then
  echo "ERROR: secret draft directory not found: $SECRET_DRAFT_DIR" >&2
  echo "Run infra/init/aws-setup.sh first, then review and complete the generated drafts." >&2
  exit 1
fi

FILES=(
  prod-web.json
  prod-email.json
  prod-api.json
  prod-workers.json
  prod-runpod.json
)

NAMES=(
  prod/web
  prod/email
  prod/api
  prod/workers
  prod/runpod
)

echo "Validating local secret drafts in: $SECRET_DRAFT_DIR"
for file in "${FILES[@]}"; do
  validate_secret_file "$file"
done

existing=()
for secret_name in "${NAMES[@]}"; do
  if secret_exists "$secret_name"; then
    existing+=("$secret_name")
  fi
done

if [ "${#existing[@]}" -gt 0 ]; then
  echo "ERROR: refusing to create secrets because these already exist:" >&2
  printf '  %s\n' "${existing[@]}" >&2
  echo "This script is create-only; delete the existing secrets or create an explicit update script." >&2
  exit 1
fi

echo "Secrets to create in $AWS_REGION:"
for index in "${!FILES[@]}"; do
  echo "  ${NAMES[$index]} <= $(draft_path "${FILES[$index]}")"
done

if [ "$DRY_RUN" = "1" ]; then
  echo "DRY_RUN=1, no AWS secrets created."
  exit 0
fi

for index in "${!FILES[@]}"; do
  aws_region secretsmanager create-secret \
    --name "${NAMES[$index]}" \
    --secret-string "file://$(draft_path "${FILES[$index]}")" \
    --tags "Key=Name,Value=${NAMES[$index]}" "Key=Project,Value=${PROJECT_NAME}" >/dev/null
  echo "Created ${NAMES[$index]}"
done

echo "Secrets Manager creation complete."
