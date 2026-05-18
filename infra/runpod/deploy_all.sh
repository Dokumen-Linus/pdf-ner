#!/usr/bin/env bash
# Run the full fixed Runpod OCR Pod deployment flow from one local command.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
STATE_FILE="${STATE_FILE:-${SCRIPT_DIR}/local-state/runpod-state.json}"
SECRET_DRAFT_FILE="${SECRET_DRAFT_FILE:-${REPO_ROOT}/infra/init/local-secrets/prod-runpod.json}"

if [ ! -f "$LOCAL_ENV_FILE" ]; then
  echo "ERROR: missing $LOCAL_ENV_FILE" >&2
  echo "Create it from infra/runpod/.env.example before running this script." >&2
  exit 1
fi

# Load local deploy inputs once so child scripts use the same values.
set -a
# shellcheck disable=SC1090
. "$LOCAL_ENV_FILE"
set +a

export LOCAL_ENV_FILE
export STATE_FILE
export SECRET_DRAFT_FILE

run_step() {
  local label="$1"
  shift

  echo
  echo "==> Starting: $label"
  "$@"
  echo "==> Finished: $label"
}

cd "$REPO_ROOT"

run_step "Runpod preflight" bash "${SCRIPT_DIR}/preflight-first-pods.sh"

run_step "Build, push, deploy Pods, and patch prod/runpod draft" \
  env SKIP_PREFLIGHT=1 bash "${SCRIPT_DIR}/deploy-first-pods.sh"

run_step "Smoke test fixed OCR Pods" bash "${SCRIPT_DIR}/test-pods.sh"

cat <<EOF

Runpod deploy_all complete.

State file:
$STATE_FILE

Secret draft patched if present:
$SECRET_DRAFT_FILE
EOF
