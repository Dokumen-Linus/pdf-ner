#!/usr/bin/env bash
# Smoke test deployed Runpod load-balancing OCR endpoints.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
STATE_FILE="${STATE_FILE:-${SCRIPT_DIR}/local-state/runpod-state.json}"
TMP_DIR="${TMPDIR:-/tmp}"
SMOKE_PNG="${SMOKE_PNG:-${TMP_DIR}/dokumen-runpod-smoke.png}"

if [ -f "$LOCAL_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$LOCAL_ENV_FILE"
  set +a
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1" >&2
    exit 1
  fi
}

require_cmd base64
require_cmd curl
require_cmd jq

RUNPOD_API_KEY="${RUNPOD_API_KEY:-}"
if [ -z "$RUNPOD_API_KEY" ] || [ "$RUNPOD_API_KEY" = "REPLACE_ME" ]; then
  echo "ERROR: RUNPOD_API_KEY is required." >&2
  exit 1
fi

state_value() {
  local filter="$1"
  if [ -f "$STATE_FILE" ]; then
    jq -r "${filter} // empty" "$STATE_FILE"
  fi
}

endpoint_base_url() {
  local explicit_url="$1"
  local endpoint_id="$2"
  local state_filter="$3"
  local state_url

  if [ -n "$explicit_url" ]; then
    printf '%s' "${explicit_url%/ocr}"
    return 0
  fi

  if [ -n "$endpoint_id" ]; then
    printf 'https://%s.api.runpod.ai' "$endpoint_id"
    return 0
  fi

  state_url="$(state_value "$state_filter")"
  if [ -n "$state_url" ]; then
    printf '%s' "${state_url%/ocr}"
  fi
}

write_smoke_png() {
  base64 -d > "$SMOKE_PNG" <<'PNG'
iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAAAAACPAi4CAAABTklEQVR4Ae3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPgOQkQAAUaFZ2gAAAAASUVORK5CYII=
PNG
}

poll_ready() {
  local name="$1"
  local base_url="$2"
  local attempts="${HEALTH_ATTEMPTS:-60}"
  local delay="${HEALTH_DELAY_SECONDS:-10}"
  local status body

  echo "Waiting for $name readiness at ${base_url}/ping ..."
  for attempt in $(seq 1 "$attempts"); do
    body="$(mktemp)"
    status="$(curl -sS -o "$body" -w '%{http_code}' \
      -H "Authorization: Bearer ${RUNPOD_API_KEY}" \
      "${base_url}/ping" || true)"

    if [ "$status" = "200" ]; then
      rm -f "$body"
      echo "$name is ready."
      return 0
    fi

    if [ "$status" != "204" ] && [ "$status" != "502" ] && ! grep -qi "no workers available" "$body"; then
      echo "Unexpected $name health response: HTTP $status" >&2
      cat "$body" >&2 || true
      rm -f "$body"
      return 1
    fi

    rm -f "$body"
    echo "  $name warming up ($attempt/$attempts, HTTP $status)."
    sleep "$delay"
  done

  echo "ERROR: $name did not become ready after $attempts attempts." >&2
  return 1
}

post_ocr() {
  local name="$1"
  local base_url="$2"
  local response
  response="$(mktemp)"

  echo "Posting OCR smoke image to $name ..."
  curl -fsS \
    -X POST "${base_url}/ocr" \
    -H "Authorization: Bearer ${RUNPOD_API_KEY}" \
    -H "Content-Type: image/png" \
    --data-binary "@${SMOKE_PNG}" > "$response"

  jq -e '
    type == "object"
    and (.text | type == "string")
    and (.model | type == "string")
    and (.usage | type == "object")
    and (.usage.prompt_tokens | type == "number")
    and (.usage.completion_tokens | type == "number")
  ' "$response" >/dev/null

  echo "$name OCR response shape is valid."
  rm -f "$response"
}

main() {
  local deepseek_base olm_base
  deepseek_base="$(endpoint_base_url "${DEEPSEEK_BASE_URL:-}" "${DEEPSEEK_ENDPOINT_ID:-}" '.["deepseek-ocr"].ocr_url')"
  olm_base="$(endpoint_base_url "${OLM_OCR2_BASE_URL:-}" "${OLM_OCR2_ENDPOINT_ID:-}" '.["olm-ocr2"].ocr_url')"

  if [ -z "$deepseek_base" ]; then
    echo "ERROR: missing DeepSeek endpoint. Set DEEPSEEK_ENDPOINT_ID or DEEPSEEK_BASE_URL." >&2
    exit 1
  fi
  if [ -z "$olm_base" ]; then
    echo "ERROR: missing olmOCR2 endpoint. Set OLM_OCR2_ENDPOINT_ID or OLM_OCR2_BASE_URL." >&2
    exit 1
  fi

  write_smoke_png
  poll_ready "deepseek-ocr" "$deepseek_base"
  post_ocr "deepseek-ocr" "$deepseek_base"
  poll_ready "olm-ocr2" "$olm_base"
  post_ocr "olm-ocr2" "$olm_base"

  echo "Runpod OCR endpoint smoke tests passed."
}

main "$@"
