#!/usr/bin/env bash
# Create a fresh Runpod registry auth for AWS ECR's short-lived Docker token.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
STATE_DIR="${STATE_DIR:-${SCRIPT_DIR}/local-state}"
STATE_FILE="${STATE_FILE:-${STATE_DIR}/runpod-state.json}"

if [ -f "$LOCAL_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$LOCAL_ENV_FILE"
  set +a
fi

AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="${PROJECT_NAME:-dokumen}"
REGISTRY_AUTH_NAME="${REGISTRY_AUTH_NAME:-${PROJECT_NAME}-ecr-$(date -u +%Y%m%d%H%M%S)-$$}"
RUNPOD_API_KEY="${RUNPOD_API_KEY:-}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1" >&2
    exit 1
  fi
}

state_set() {
  local key="$1"
  local value="$2"
  local tmp
  mkdir -p "$STATE_DIR"
  if [ ! -f "$STATE_FILE" ]; then
    printf '{}\n' > "$STATE_FILE"
  fi
  tmp="${STATE_FILE}.tmp"
  jq --arg key "$key" --arg value "$value" '.[$key] = $value' "$STATE_FILE" > "$tmp"
  mv "$tmp" "$STATE_FILE"
}

require_cmd aws
require_cmd jq
require_cmd runpodctl

ECR_PASSWORD="$(aws --region "$AWS_REGION" ecr get-login-password)"
CREATE_RESPONSE="$(runpodctl registry create \
  --name "$REGISTRY_AUTH_NAME" \
  --username AWS \
  --password "$ECR_PASSWORD" \
  --output json)"

REGISTRY_AUTH_ID="$(printf '%s' "$CREATE_RESPONSE" | jq -r '.id // .registryAuthId // .containerRegistryAuthId // empty')"
if [ -z "$REGISTRY_AUTH_ID" ]; then
  echo "ERROR: unable to read Runpod registry auth id from response:" >&2
  printf '%s\n' "$CREATE_RESPONSE" >&2
  exit 1
fi

state_set container_registry_auth_id "$REGISTRY_AUTH_ID"
state_set container_registry_auth_name "$REGISTRY_AUTH_NAME"
state_set ecr_auth_refreshed_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat <<EOF
Created fresh Runpod registry auth for ECR.
Name: $REGISTRY_AUTH_NAME
ID:   $REGISTRY_AUTH_ID
State: $STATE_FILE
EOF
