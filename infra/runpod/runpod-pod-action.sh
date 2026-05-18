#!/usr/bin/env bash
# Refresh ECR registry auth and patch Pods before lifecycle actions that can force Pod image pulls.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
STATE_FILE="${STATE_FILE:-${SCRIPT_DIR}/local-state/runpod-state.json}"
RUNPOD_REST_URL="${RUNPOD_REST_URL:-https://rest.runpod.io/v1}"

if [ -f "$LOCAL_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$LOCAL_ENV_FILE"
  set +a
fi

ACTION="${1:-}"
TARGET="${2:-all}"

usage() {
  cat <<EOF
Usage: bash infra/runpod/runpod-pod-action.sh <start|stop|restart|reset> [deepseek-ocr|olm-ocr2|all]

Examples:
  bash infra/runpod/runpod-pod-action.sh restart all
  bash infra/runpod/runpod-pod-action.sh start deepseek-ocr
EOF
}

if [ "$ACTION" != "start" ] && [ "$ACTION" != "stop" ] && [ "$ACTION" != "restart" ] && [ "$ACTION" != "reset" ]; then
  usage >&2
  exit 1
fi

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

state_value() {
  local filter="$1"
  if [ -f "$STATE_FILE" ]; then
    jq -r "${filter} // empty" "$STATE_FILE"
  fi
}

pod_id_for() {
  local worker="$1"
  case "$worker" in
    deepseek-ocr)
      printf '%s' "${DEEPSEEK_RUNPOD_POD_ID:-$(state_value '.["deepseek-ocr"].pod_id')}"
      ;;
    olm-ocr2)
      printf '%s' "${OLM_OCR2_RUNPOD_POD_ID:-$(state_value '.["olm-ocr2"].pod_id')}"
      ;;
    *)
      echo "ERROR: unknown worker: $worker" >&2
      exit 1
      ;;
  esac
}

run_action() {
  local worker="$1"
  local pod_id
  pod_id="$(pod_id_for "$worker")"
  if [ -z "$pod_id" ]; then
    echo "ERROR: missing Pod ID for $worker." >&2
    exit 1
  fi
  echo "Running runpodctl pod $ACTION for $worker ($pod_id)"
  runpodctl pod "$ACTION" "$pod_id"
}

refresh_pod_registry_auth() {
  local worker="$1"
  local pod_id
  local auth_id
  pod_id="$(pod_id_for "$worker")"
  auth_id="$(state_value '.container_registry_auth_id')"

  if [ -z "$pod_id" ]; then
    echo "ERROR: missing Pod ID for $worker." >&2
    exit 1
  fi
  if [ -z "$auth_id" ]; then
    echo "ERROR: missing Runpod container registry auth id in $STATE_FILE." >&2
    exit 1
  fi

  curl -fsS \
    --request PATCH \
    --url "${RUNPOD_REST_URL}/pods/${pod_id}" \
    --header "Authorization: Bearer ${RUNPOD_API_KEY}" \
    --header "Content-Type: application/json" \
    --data "$(jq -cn --arg auth_id "$auth_id" '{containerRegistryAuthId: $auth_id}')" \
    >/dev/null
}

require_cmd jq
require_cmd runpodctl
require_cmd curl

if [ "$ACTION" = "start" ] || [ "$ACTION" = "restart" ] || [ "$ACTION" = "reset" ]; then
  require_env RUNPOD_API_KEY
fi

if [ "$ACTION" = "start" ] || [ "$ACTION" = "restart" ] || [ "$ACTION" = "reset" ]; then
  bash "${SCRIPT_DIR}/sync-ecr-runpod-registry-auth.sh"
  case "$TARGET" in
    all)
      refresh_pod_registry_auth deepseek-ocr
      refresh_pod_registry_auth olm-ocr2
      ;;
    deepseek-ocr|olm-ocr2)
      refresh_pod_registry_auth "$TARGET"
      ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
fi

case "$TARGET" in
  all)
    run_action deepseek-ocr
    run_action olm-ocr2
    ;;
  deepseek-ocr|olm-ocr2)
    run_action "$TARGET"
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
