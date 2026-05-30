#!/usr/bin/env bash
set -euo pipefail

REQUIRE_WEB_LOCAL_CHECK="${REQUIRE_WEB_LOCAL_CHECK:-0}"
WEB_LOCAL_URL="${WEB_LOCAL_URL:-http://127.0.0.1:3000/api/healthz}"

fail() {
  echo "Cloudflare origin verification failed: $*" >&2
  exit 1
}

check_cloudflared() {
  if ! systemctl is-active --quiet cloudflared; then
    fail "cloudflared.service is not active"
  fi
  echo "cloudflared.service is active." >&2
}

check_no_public_http_listeners() {
  if ! command -v ss >/dev/null 2>&1; then
    echo "Skipping public listener check because 'ss' is not installed." >&2
    return
  fi

  local public_listeners
  public_listeners="$(
    ss -ltnH \
      | awk '$4 ~ /(^|:)(0\.0\.0\.0|\[::\]|\*):?(80|443)$/ || $4 ~ /(^|:)(0\.0\.0\.0|\[::\]|\*):(80|443)$/ { print }'
  )"

  if [[ -n "$public_listeners" ]]; then
    echo "$public_listeners" >&2
    fail "found a public HTTP/HTTPS listener on 0.0.0.0, [::], or *"
  fi

  echo "No public 80/443 host listeners found." >&2
}

check_web_local_if_available() {
  local status
  status="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 5 "$WEB_LOCAL_URL" 2>/dev/null || true)"

  if [[ "$status" == "200" ]]; then
    echo "Web local health check passed: ${WEB_LOCAL_URL}" >&2
    return
  fi

  if [[ "$REQUIRE_WEB_LOCAL_CHECK" == "1" ]]; then
    fail "web local health check returned ${status:-no response}: ${WEB_LOCAL_URL}"
  fi

  echo "Web local health check skipped; web is not listening yet at ${WEB_LOCAL_URL}." >&2
}

check_cloudflared
check_no_public_http_listeners
check_web_local_if_available

echo "Cloudflare origin verification passed." >&2
