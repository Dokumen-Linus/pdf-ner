#!/usr/bin/env bash
# Check local prerequisites before creating the first fixed Runpod OCR Pods.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"

# Load local Runpod deploy inputs without printing secret values.
if [ ! -f "$LOCAL_ENV_FILE" ]; then
  echo "ERROR: missing $LOCAL_ENV_FILE" >&2
  echo "Create it from infra/runpod/.env.example, then set RUNPOD_API_KEY, OCR_HTTP_BEARER_TOKEN, IMAGE_TAG, and CREATE_PODS=1." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
. "$LOCAL_ENV_FILE"
set +a

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1" >&2
    exit 1
  fi
}

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ] || [ "${!name}" = "REPLACE_ME" ]; then
    echo "ERROR: required environment variable is missing or still REPLACE_ME: $name" >&2
    exit 1
  fi
}

# Verify required local commands are installed.
require_cmd aws
require_cmd curl
require_cmd docker
require_cmd jq
require_cmd runpodctl

# Verify required first-pod deploy settings are present.
require_env AWS_REGION
require_env IMAGE_TAG
require_env RUNPOD_API_KEY
require_env OCR_HTTP_BEARER_TOKEN

# Prevent mutable image tags from being deployed.
if [ "$IMAGE_TAG" = "latest" ]; then
  echo "ERROR: IMAGE_TAG must be immutable; do not use latest." >&2
  exit 1
fi

# Verify this is configured as either a first bootstrap or a fixed-Pod deploy.
if [ -z "${DEEPSEEK_RUNPOD_POD_ID:-}" ] && [ -z "${OLM_OCR2_RUNPOD_POD_ID:-}" ]; then
  if [ "${CREATE_PODS:-0}" != "1" ]; then
    echo "ERROR: set CREATE_PODS=1 in $LOCAL_ENV_FILE for first Pod creation." >&2
    exit 1
  fi
elif [ -n "${DEEPSEEK_RUNPOD_POD_ID:-}" ] && [ -n "${OLM_OCR2_RUNPOD_POD_ID:-}" ]; then
  if [ "${CREATE_PODS:-0}" = "1" ]; then
    echo "ERROR: set CREATE_PODS=0 after both fixed Pod IDs are saved." >&2
    exit 1
  fi
else
  echo "ERROR: Pod IDs must be either both blank for first bootstrap or both set for fixed Pod deploys." >&2
  exit 1
fi

# Verify AWS credentials can see the current account without refreshing login.
aws sts get-caller-identity --query Account --output text >/dev/null

# Verify Docker is usable by the current user.
docker info >/dev/null

# Verify runpodctl can authenticate using the exported RUNPOD_API_KEY.
runpodctl user >/dev/null

cat <<EOF
Runpod first-pod preflight passed.
Config: $LOCAL_ENV_FILE
Image tag: $IMAGE_TAG
Create pods: ${CREATE_PODS:-0}
EOF
