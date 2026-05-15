#!/usr/bin/env bash
# Refresh ECR registry auth before lifecycle actions that can force Pod image pulls.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
STATE_FILE="${STATE_FILE:-${SCRIPT_DIR}/local-state/runpod-state.json}"

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

require_cmd jq
require_cmd runpodctl

if [ -n "${RUNPOD_API_KEY:-}" ]; then
  runpodctl config --apiKey "$RUNPOD_API_KEY" >/dev/null
fi

if [ "$ACTION" = "start" ] || [ "$ACTION" = "restart" ] || [ "$ACTION" = "reset" ]; then
  bash "${SCRIPT_DIR}/sync-ecr-runpod-registry-auth.sh"
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
