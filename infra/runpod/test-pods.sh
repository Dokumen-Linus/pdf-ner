#!/usr/bin/env bash
# Smoke test deployed Runpod Pod OCR services.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
STATE_FILE="${STATE_FILE:-${SCRIPT_DIR}/local-state/runpod-state.json}"
TMP_DIR="${TMPDIR:-/tmp}"
SMOKE_PNG="${SMOKE_PNG:-${TMP_DIR}/dokumen-runpod-pod-smoke.png}"
PORT="${PORT:-8000}"

if [ -f "$LOCAL_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$LOCAL_ENV_FILE"
  set +a
fi

RUNPOD_API_KEY="${RUNPOD_API_KEY:-}"
OCR_HTTP_BEARER_TOKEN="${OCR_HTTP_BEARER_TOKEN:-${OCR_RUNPOD_HTTP_TOKEN:-}}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1" >&2
    exit 1
  fi
}

require_cmd base64
require_cmd curl
require_cmd jq
require_cmd runpodctl

if [ -z "$OCR_HTTP_BEARER_TOKEN" ] || [ "$OCR_HTTP_BEARER_TOKEN" = "REPLACE_ME" ]; then
  echo "ERROR: OCR_HTTP_BEARER_TOKEN or OCR_RUNPOD_HTTP_TOKEN is required." >&2
  exit 1
fi

state_value() {
  local filter="$1"
  if [ -f "$STATE_FILE" ]; then
    jq -r "${filter} // empty" "$STATE_FILE"
  fi
}

pod_id_for() {
  local explicit_id="$1"
  local state_filter="$2"
  if [ -n "$explicit_id" ]; then
    printf '%s' "$explicit_id"
    return 0
  fi
  state_value "$state_filter"
}

pod_base_url() {
  local explicit_url="$1"
  local pod_id="$2"
  if [ -n "$explicit_url" ]; then
    printf '%s' "${explicit_url%/ocr}"
    return 0
  fi
  printf 'https://%s-%s.proxy.runpod.net' "$pod_id" "$PORT"
}

write_smoke_png() {
  base64 -d > "$SMOKE_PNG" <<'PNG'
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
PNG
}

assert_pod_storage() {
  local name="$1"
  local pod_id="$2"
  local details network_volume mount_path

  details="$(runpodctl pod get "$pod_id" --include-network-volume --output json)"
  network_volume="$(printf '%s' "$details" | jq -r '.networkVolume.id // .networkVolumeId // empty')"
  mount_path="$(printf '%s' "$details" | jq -r '.volumeMountPath // .container.volumeMountPath // empty')"

  if [ -n "$network_volume" ]; then
    echo "ERROR: $name has a network volume attached: $network_volume" >&2
    exit 1
  fi
  if [ -n "$mount_path" ] && [ "$mount_path" != "/workspace" ]; then
    echo "ERROR: $name volume mount path is $mount_path, expected /workspace" >&2
    exit 1
  fi
}

poll_ready() {
  local name="$1"
  local base_url="$2"
  local attempts="${HEALTH_ATTEMPTS:-60}"
  local delay="${HEALTH_DELAY_SECONDS:-10}"
  local status

  echo "Waiting for $name readiness at ${base_url}/ping ..."
  for attempt in $(seq 1 "$attempts"); do
    status="$(curl -sS -o /dev/null -w '%{http_code}' "${base_url}/ping" || true)"
    if [ "$status" = "200" ]; then
      echo "$name is ready."
      return 0
    fi
    if [ "$status" != "204" ] && [ "$status" != "502" ] && [ "$status" != "000" ]; then
      echo "Unexpected $name health response: HTTP $status" >&2
      return 1
    fi
    echo "  $name warming up ($attempt/$attempts, HTTP $status)."
    sleep "$delay"
  done

  echo "ERROR: $name did not become ready after $attempts attempts." >&2
  return 1
}

assert_auth_required() {
  local name="$1"
  local base_url="$2"
  local status

  status="$(curl -sS -o /dev/null -w '%{http_code}' \
    -X POST "${base_url}/ocr" \
    -H "Content-Type: image/png" \
    --data-binary "@${SMOKE_PNG}" || true)"

  if [ "$status" != "401" ]; then
    echo "ERROR: expected unauthenticated $name OCR request to return 401, got $status." >&2
    return 1
  fi
}

post_ocr() {
  local name="$1"
  local base_url="$2"
  local response
  response="$(mktemp)"
  trap 'rm -f "$response"' RETURN

  echo "Posting authenticated OCR smoke image to $name ..."
  curl -fsS \
    -X POST "${base_url}/ocr" \
    -H "Authorization: Bearer ${OCR_HTTP_BEARER_TOKEN}" \
    -H "Content-Type: image/png" \
    --data-binary "@${SMOKE_PNG}" > "$response" || {
    local status=$?
    rm -f "$response"
    trap - RETURN
    return "$status"
  }

  jq -e '
    type == "object"
    and (.text | type == "string")
    and ((.text | ascii_downcase) | test("dokumen|ocr"))
    and (.model | type == "string")
    and (.usage | type == "object")
    and (.usage.prompt_tokens | type == "number")
    and (.usage.completion_tokens | type == "number")
  ' "$response" >/dev/null || {
    rm -f "$response"
    trap - RETURN
    return 1
  }

  echo "$name OCR response shape is valid."
  rm -f "$response"
  trap - RETURN
}

main() {
  local deepseek_pod_id olm_pod_id deepseek_base olm_base
  deepseek_pod_id="$(pod_id_for "${DEEPSEEK_RUNPOD_POD_ID:-}" '.["deepseek-ocr"].pod_id')"
  olm_pod_id="$(pod_id_for "${OLM_OCR2_RUNPOD_POD_ID:-}" '.["olm-ocr2"].pod_id')"

  if [ -z "$deepseek_pod_id" ]; then
    echo "ERROR: missing DeepSeek Pod ID. Set DEEPSEEK_RUNPOD_POD_ID or deploy state." >&2
    exit 1
  fi
  if [ -z "$olm_pod_id" ]; then
    echo "ERROR: missing olmOCR2 Pod ID. Set OLM_OCR2_RUNPOD_POD_ID or deploy state." >&2
    exit 1
  fi

  deepseek_base="$(pod_base_url "${DEEPSEEK_BASE_URL:-}" "$deepseek_pod_id")"
  olm_base="$(pod_base_url "${OLM_OCR2_BASE_URL:-}" "$olm_pod_id")"

  write_smoke_png
  assert_pod_storage "deepseek-ocr" "$deepseek_pod_id"
  assert_pod_storage "olm-ocr2" "$olm_pod_id"
  poll_ready "deepseek-ocr" "$deepseek_base"
  assert_auth_required "deepseek-ocr" "$deepseek_base"
  post_ocr "deepseek-ocr" "$deepseek_base"
  poll_ready "olm-ocr2" "$olm_base"
  assert_auth_required "olm-ocr2" "$olm_base"
  post_ocr "olm-ocr2" "$olm_base"

  echo "Runpod OCR Pod smoke tests passed."
}

main "$@"
