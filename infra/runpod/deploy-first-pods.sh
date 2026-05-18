#!/usr/bin/env bash
# Create or update the fixed Runpod OCR Pods and patch the local prod/runpod secret draft.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
STATE_FILE="${STATE_FILE:-${SCRIPT_DIR}/local-state/runpod-state.json}"
SECRET_DRAFT_FILE="${SECRET_DRAFT_FILE:-${REPO_ROOT}/infra/init/local-secrets/prod-runpod.json}"

# Run the same checks the operator can run manually.
if [ "${SKIP_PREFLIGHT:-0}" != "1" ]; then
  bash "${SCRIPT_DIR}/preflight-first-pods.sh"
fi

# Deploy images and fixed Pods using the existing Runpod deploy implementation.
# For first creation, keep CREATE_PODS=1 in infra/runpod/.env.local.
CREATE_PODS="${CREATE_PODS:-1}" \
LOCAL_ENV_FILE="$LOCAL_ENV_FILE" \
STATE_FILE="$STATE_FILE" \
bash "${SCRIPT_DIR}/runpod-deploy-pods.sh"

# Load local Runpod deploy inputs so the HTTP token can be copied into the secret draft.
set -a
# shellcheck disable=SC1090
. "$LOCAL_ENV_FILE"
set +a

# Read the deployed Pod IDs and endpoint URLs from the local Runpod state file.
DEEPSEEK_POD_ID="$(jq -r '.["deepseek-ocr"].pod_id // empty' "$STATE_FILE")"
OLM_OCR2_POD_ID="$(jq -r '.["olm-ocr2"].pod_id // empty' "$STATE_FILE")"
DEEPSEEK_OCR_URL="$(jq -r '.["deepseek-ocr"].ocr_url // empty' "$STATE_FILE")"
OLM_OCR2_URL="$(jq -r '.["olm-ocr2"].ocr_url // empty' "$STATE_FILE")"

# Fail if deployment did not produce both fixed Pod IDs and endpoint URLs.
if [ -z "$DEEPSEEK_POD_ID" ] || [ -z "$OLM_OCR2_POD_ID" ] || [ -z "$DEEPSEEK_OCR_URL" ] || [ -z "$OLM_OCR2_URL" ]; then
  echo "ERROR: missing Pod IDs or endpoint URLs in $STATE_FILE" >&2
  exit 1
fi

# Patch the local prod/runpod secret draft if aws-setup generated it.
if [ -f "$SECRET_DRAFT_FILE" ]; then
  tmp="${SECRET_DRAFT_FILE}.tmp"
  jq \
    --arg deepseek_url "$DEEPSEEK_OCR_URL" \
    --arg olm_url "$OLM_OCR2_URL" \
    --arg token "$OCR_HTTP_BEARER_TOKEN" \
    '.OCR_MODEL = (.OCR_MODEL // "deepseek-ocr")
      | .DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL = $deepseek_url
      | .OLM_OCR2_RUNPOD_ENDPOINT_URL = $olm_url
      | .OCR_RUNPOD_HTTP_TOKEN = $token
      | .OCR_RUNPOD_TIMEOUT_SECONDS = (.OCR_RUNPOD_TIMEOUT_SECONDS // 60)
      | .OCR_RUNPOD_RETRIES = (.OCR_RUNPOD_RETRIES // 0)' \
    "$SECRET_DRAFT_FILE" > "$tmp"
  mv "$tmp" "$SECRET_DRAFT_FILE"
  chmod 600 "$SECRET_DRAFT_FILE" 2>/dev/null || true
else
  echo "WARNING: $SECRET_DRAFT_FILE not found; secret draft was not patched." >&2
fi

cat <<EOF

Runpod fixed Pod deployment complete.

Save these Pod IDs in infra/runpod/.env.local and GitHub Actions variables:
DEEPSEEK_RUNPOD_POD_ID=$DEEPSEEK_POD_ID
OLM_OCR2_RUNPOD_POD_ID=$OLM_OCR2_POD_ID

Runtime secret values for prod/runpod:
DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL=$DEEPSEEK_OCR_URL
OLM_OCR2_RUNPOD_ENDPOINT_URL=$OLM_OCR2_URL
OCR_RUNPOD_HTTP_TOKEN=<same value as OCR_HTTP_BEARER_TOKEN>

Patched secret draft, if present:
$SECRET_DRAFT_FILE

Next check:
bash infra/runpod/test-pods.sh
EOF
