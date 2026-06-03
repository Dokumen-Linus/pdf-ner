# shellcheck shell=bash
# Cloudflare API helper — requires CLOUDFLARE_API_TOKEN and CF_API_BASE to be set.

cf_api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local response

  if [[ -n "$body" ]]; then
    response="$(
      curl -sS \
        --request "$method" \
        --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
        --header "Content-Type: application/json" \
        --data "$body" \
        "${CF_API_BASE}${path}"
    )"
  else
    response="$(
      curl -sS \
        --request "$method" \
        --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
        "${CF_API_BASE}${path}"
    )"
  fi

  if jq -e '.success == true' >/dev/null 2>&1 <<< "$response"; then
    printf '%s\n' "$response"
    return
  fi

  echo "Cloudflare API request failed: ${method} ${path}" >&2
  jq -r '.errors[]? | "  - \(.message)"' <<< "$response" >&2
  return 1
}

# Verify a Cloudflare API token. Tries account-level verification first,
# then falls back to user-level verification.
verify_cloudflare_token() {
  if cf_api GET "/accounts/${CLOUDFLARE_ACCOUNT_ID}/tokens/verify" >/dev/null 2>&1; then
    echo "Verified Cloudflare API token (account-level)." >&2
    return
  fi

  if ! cf_api GET "/user/tokens/verify" >/dev/null; then
    echo "Cloudflare API token verification failed against account and user token endpoints. Check CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID." >&2
    return 1
  fi
  echo "Verified Cloudflare API token (user-level)." >&2
}
