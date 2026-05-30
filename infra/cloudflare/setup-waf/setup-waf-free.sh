#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE_ARG="${1:-}"

source "${SCRIPT_DIR}/../../shared/load-env-file.sh"
source "${SCRIPT_DIR}/../shared/cf-api.sh"
source "${SCRIPT_DIR}/lib-waf.sh"

load_env_file "${LOCAL_ENV_FILE:-${ENV_FILE_ARG:-${SCRIPT_DIR}/.env.local}}"

CF_API_BASE="${CF_API_BASE:-https://api.cloudflare.com/client/v4}"
PUBLIC_HOSTNAMES="${PUBLIC_HOSTNAMES:-dokumenai.dev www.dokumenai.dev}"
WAF_MODE="${WAF_MODE:-monitor}"
DRY_RUN="${DRY_RUN:-0}"

CLOUDFLARE_FREE_RULESET_ID="${CLOUDFLARE_FREE_RULESET_ID:-77454fe2d30c4220b5701f6fdfb893ba}"

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

# Free plan rate limiting does not support 'log' action.
# Override to 'block' unconditionally since only 1 rate limit rule is allowed.
rate_limit_action="block"

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

managed_rules_json() {
  jq -n \
    --arg managed_id "$CLOUDFLARE_FREE_RULESET_ID" \
    --arg host_expr "$hostname_expression" \
    '[
      {
        ref: "dokumen_execute_free_managed_ruleset",
        description: "Dokumen: execute Cloudflare Free Managed Ruleset for production hostnames",
        expression: $host_expr,
        action: "execute",
        action_parameters: {id: $managed_id},
        enabled: true
      }
    ]'
}

# Free plan allows 1 rate limiting rule — keep only auth writes.
rate_limit_rules_json() {
  jq -n \
    --arg host_expr "$hostname_expression" \
    --arg action "$rate_limit_action" \
    '[
      {
        ref: "dokumen_rate_limit_auth_writes",
        description: "Dokumen: rate limit auth writes",
        expression: "(\($host_expr)) and http.request.method eq \"POST\" and starts_with(http.request.uri.path, \"/api/auth/\")",
        action: $action,
        ratelimit: {
          characteristics: ["cf.colo.id", "ip.src"],
          period: 10,
          requests_per_period: 3,
          mitigation_timeout: 10,
          requests_to_origin: false
        },
        enabled: true
      }
    ]'
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

echo "Cloudflare WAF setup complete (Free plan)." >&2

printf 'CLOUDFLARE_WAF_CUSTOM_RULESET_ID=%s\n' "$custom_ruleset_id"
printf 'CLOUDFLARE_WAF_MANAGED_RULESET_ID=%s\n' "$managed_ruleset_id"
printf 'CLOUDFLARE_WAF_RATELIMIT_RULESET_ID=%s\n' "$rate_limit_ruleset_id"
