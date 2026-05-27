#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE_ARG="${1:-}"

load_env_file() {
  local env_file="$1"
  if [ -f "$env_file" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$env_file"
    set +a
    echo "Loaded env file: ${env_file}" >&2
  else
    echo "Env file not found, continuing with current environment: ${env_file}" >&2
  fi
}

load_env_file "${LOCAL_ENV_FILE:-${ENV_FILE_ARG:-${SCRIPT_DIR}/.env.local}}"

CF_API_BASE="${CF_API_BASE:-https://api.cloudflare.com/client/v4}"
PUBLIC_HOSTNAMES="${PUBLIC_HOSTNAMES:-dokumenai.dev www.dokumenai.dev}"
WAF_MODE="${WAF_MODE:-monitor}"
DRY_RUN="${DRY_RUN:-0}"

CLOUDFLARE_MANAGED_RULESET_ID="${CLOUDFLARE_MANAGED_RULESET_ID:-efb7b8c949ac4650a09736fc376e9aee}"

required_vars=(
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_ZONE_ID
)

if [[ "$DRY_RUN" != "1" ]]; then
  required_vars+=(CLOUDFLARE_API_TOKEN)
fi

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "${var_name} is required."
    exit 1
  fi
done
echo "Required Cloudflare WAF environment variables are present." >&2

for command_name in curl jq; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "${command_name} is required."
    exit 1
  fi
done
echo "Required local commands are available: curl jq." >&2

case "$WAF_MODE" in
  monitor) rate_limit_action="log" ;;
  enforce) rate_limit_action="block" ;;
  *)
    echo "WAF_MODE must be 'monitor' or 'enforce'."
    exit 1
    ;;
esac

hostnames_json="$(
  tr ' ' '\n' <<< "$PUBLIC_HOSTNAMES" \
    | sed '/^$/d' \
    | jq -R . \
    | jq -s .
)"

if [[ "$(jq 'length' <<< "$hostnames_json")" == "0" ]]; then
  echo "PUBLIC_HOSTNAMES must contain at least one hostname."
  exit 1
fi

hostname_expression="$(
  jq -r '
    if length == 1 then
      "http.host eq \"" + .[0] + "\""
    else
      "http.host in {" + (map("\"" + . + "\"") | join(" ")) + "}"
    end
  ' <<< "$hostnames_json"
)"

unexpected_hostname_expression="$(
  jq -r '
    if length == 1 then
      "http.host ne \"" + .[0] + "\""
    else
      "not http.host in {" + (map("\"" + . + "\"") | join(" ")) + "}"
    end
  ' <<< "$hostnames_json"
)"

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

cf_api_optional_entrypoint() {
  local phase="$1"
  local tmp_file status response
  tmp_file="$(mktemp)"

  status="$(
    curl -sS \
      --request GET \
      --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      --output "$tmp_file" \
      --write-out "%{http_code}" \
      "${CF_API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/rulesets/phases/${phase}/entrypoint"
  )"
  response="$(cat "$tmp_file")"
  rm -f "$tmp_file"

  if [[ "$status" == "404" ]]; then
    return 2
  fi

  if jq -e '.success == true' >/dev/null 2>&1 <<< "$response"; then
    printf '%s\n' "$response"
    return
  fi

  echo "Cloudflare API request failed: GET /zones/${CLOUDFLARE_ZONE_ID}/rulesets/phases/${phase}/entrypoint" >&2
  jq -r '.errors[]? | "  - \(.message)"' <<< "$response" >&2
  return 1
}

verify_cloudflare_token() {
  if ! cf_api GET "/user/tokens/verify" >/dev/null; then
    echo "Cloudflare API token verification failed. Check CLOUDFLARE_API_TOKEN in the loaded env file." >&2
    return 1
  fi
  echo "Verified Cloudflare API token." >&2
}

custom_rules_json() {
  jq -n \
    --arg unexpected_host "$unexpected_hostname_expression" \
    '[
      {
        ref: "dokumen_skip_verified_bots",
        description: "Dokumen: skip verified bots for remaining custom WAF rules",
        expression: "(cf.client.bot)",
        action: "skip",
        action_parameters: {ruleset: "current"},
        enabled: true
      },
      {
        ref: "dokumen_block_unexpected_hostnames",
        description: "Dokumen: block requests for hostnames not served by this app",
        expression: $unexpected_host,
        action: "block",
        enabled: true
      },
      {
        ref: "dokumen_block_non_standard_edge_ports",
        description: "Dokumen: block edge ports other than HTTP and HTTPS",
        expression: "(not cf.edge.server_port in {80 443})",
        action: "block",
        enabled: true
      }
    ]'
}

managed_rules_json() {
  jq -n \
    --arg managed_id "$CLOUDFLARE_MANAGED_RULESET_ID" \
    --arg host_expr "$hostname_expression" \
    '[
      {
        ref: "dokumen_execute_cloudflare_managed_ruleset",
        description: "Dokumen: execute Cloudflare Managed Ruleset for production hostnames",
        expression: $host_expr,
        action: "execute",
        action_parameters: {id: $managed_id},
        enabled: true
      }
    ]'
}

rate_limit_rules_json() {
  jq -n \
    --arg host_expr "$hostname_expression" \
    --arg action "$rate_limit_action" \
    '[
      {
        ref: "dokumen_rate_limit_auth_writes",
        description: "Dokumen: rate limit auth writes",
        expression: "(" + $host_expr + ") and http.request.method eq \"POST\" and http.request.uri.path starts_with \"/api/auth/\"",
        action: $action,
        ratelimit: {
          characteristics: ["cf.colo.id", "ip.src"],
          period: 60,
          requests_per_period: 20,
          mitigation_timeout: 600,
          requests_to_origin: false
        },
        enabled: true
      },
      {
        ref: "dokumen_rate_limit_chat_writes",
        description: "Dokumen: rate limit public chat writes",
        expression: "(" + $host_expr + ") and http.request.method eq \"POST\" and http.request.uri.path eq \"/api/chat\"",
        action: $action,
        ratelimit: {
          characteristics: ["cf.colo.id", "ip.src"],
          period: 60,
          requests_per_period: 12,
          mitigation_timeout: 600,
          requests_to_origin: false
        },
        enabled: true
      },
      {
        ref: "dokumen_rate_limit_pdf_uploads",
        description: "Dokumen: rate limit PDF uploads",
        expression: "(" + $host_expr + ") and http.request.method eq \"POST\" and http.request.uri.path eq \"/api/pdf-upload\"",
        action: $action,
        ratelimit: {
          characteristics: ["cf.colo.id", "ip.src"],
          period: 300,
          requests_per_period: 10,
          mitigation_timeout: 900,
          requests_to_origin: false
        },
        enabled: true
      },
      {
        ref: "dokumen_rate_limit_avatar_uploads",
        description: "Dokumen: rate limit avatar uploads",
        expression: "(" + $host_expr + ") and http.request.method eq \"POST\" and http.request.uri.path eq \"/api/avatar-upload\"",
        action: $action,
        ratelimit: {
          characteristics: ["cf.colo.id", "ip.src"],
          period: 300,
          requests_per_period: 20,
          mitigation_timeout: 900,
          requests_to_origin: false
        },
        enabled: true
      }
    ]'
}

phase_payload() {
  local phase="$1"
  local name="$2"
  local description="$3"
  local rules_json="$4"

  jq -n \
    --arg name "$name" \
    --arg description "$description" \
    --arg phase "$phase" \
    --argjson rules "$rules_json" \
    '{
      name: $name,
      description: $description,
      kind: "zone",
      phase: $phase,
      rules: $rules
    }'
}

merge_rules_by_ref() {
  local existing_rules="$1"
  local managed_rules="$2"

  jq -n \
    --argjson existing "$existing_rules" \
    --argjson managed "$managed_rules" \
    '
      ($managed | map(.ref)) as $managed_refs
      | ($existing
          | map(select((.ref // "") as $ref | ($managed_refs | index($ref) | not)))
          | map(with_entries(select(.key | IN(
              "id",
              "ref",
              "description",
              "expression",
              "action",
              "action_parameters",
              "ratelimit",
              "enabled",
              "logging",
              "exposed_credential_check"
            ))))
        ) + $managed
    '
}

upsert_phase_ruleset() {
  local phase="$1"
  local name="$2"
  local description="$3"
  local managed_rules="$4"
  local entrypoint_response ruleset_id existing_rules merged_rules payload

  if entrypoint_response="$(cf_api_optional_entrypoint "$phase")"; then
    ruleset_id="$(jq -r '.result.id' <<< "$entrypoint_response")"
    existing_rules="$(jq '.result.rules // []' <<< "$entrypoint_response")"
    merged_rules="$(merge_rules_by_ref "$existing_rules" "$managed_rules")"
    payload="$(phase_payload "$phase" "$name" "$description" "$merged_rules")"
    cf_api PUT "/zones/${CLOUDFLARE_ZONE_ID}/rulesets/${ruleset_id}" "$payload" >/dev/null
    echo "Updated Cloudflare WAF phase '${phase}'." >&2
  else
    local status=$?
    if [[ "$status" != "2" ]]; then
      return "$status"
    fi
    payload="$(phase_payload "$phase" "$name" "$description" "$managed_rules")"
    entrypoint_response="$(cf_api POST "/zones/${CLOUDFLARE_ZONE_ID}/rulesets" "$payload")" || return
    ruleset_id="$(jq -r '.result.id' <<< "$entrypoint_response")"
    echo "Created Cloudflare WAF phase '${phase}'." >&2
  fi

  printf '%s\n' "$ruleset_id"
}

custom_rules="$(custom_rules_json)"
managed_rules="$(managed_rules_json)"
rate_limit_rules="$(rate_limit_rules_json)"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "DRY_RUN=1; not calling Cloudflare APIs." >&2
  echo "Custom WAF payload:" >&2
  phase_payload "http_request_firewall_custom" "Dokumen custom WAF rules" "Dokumen zone-level custom WAF rules" "$custom_rules" >&2
  echo "Managed WAF payload:" >&2
  phase_payload "http_request_firewall_managed" "Dokumen managed WAF rules" "Dokumen zone-level managed WAF rules" "$managed_rules" >&2
  echo "Rate limiting payload:" >&2
  phase_payload "http_ratelimit" "Dokumen rate limiting rules" "Dokumen zone-level rate limiting rules" "$rate_limit_rules" >&2

  printf 'CLOUDFLARE_WAF_CUSTOM_RULESET_ID=%s\n' "DRY_RUN"
  printf 'CLOUDFLARE_WAF_MANAGED_RULESET_ID=%s\n' "DRY_RUN"
  printf 'CLOUDFLARE_WAF_RATELIMIT_RULESET_ID=%s\n' "DRY_RUN"
  exit 0
fi

verify_cloudflare_token || exit 1

custom_ruleset_id="$(
  upsert_phase_ruleset \
    "http_request_firewall_custom" \
    "Dokumen custom WAF rules" \
    "Dokumen zone-level custom WAF rules" \
    "$custom_rules"
)"

managed_ruleset_id="$(
  upsert_phase_ruleset \
    "http_request_firewall_managed" \
    "Dokumen managed WAF rules" \
    "Dokumen zone-level managed WAF rules" \
    "$managed_rules"
)"

rate_limit_ruleset_id="$(
  upsert_phase_ruleset \
    "http_ratelimit" \
    "Dokumen rate limiting rules" \
    "Dokumen zone-level rate limiting rules" \
    "$rate_limit_rules"
)"

echo "Cloudflare WAF setup complete." >&2

printf 'CLOUDFLARE_WAF_CUSTOM_RULESET_ID=%s\n' "$custom_ruleset_id"
printf 'CLOUDFLARE_WAF_MANAGED_RULESET_ID=%s\n' "$managed_ruleset_id"
printf 'CLOUDFLARE_WAF_RATELIMIT_RULESET_ID=%s\n' "$rate_limit_ruleset_id"
