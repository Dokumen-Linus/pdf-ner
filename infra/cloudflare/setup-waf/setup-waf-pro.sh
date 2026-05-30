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

CLOUDFLARE_MANAGED_RULESET_ID="${CLOUDFLARE_MANAGED_RULESET_ID:-efb7b8c949ac4650a09736fc376e9aee}"
CLOUDFLARE_OWASP_RULESET_ID="${CLOUDFLARE_OWASP_RULESET_ID:-4814384a9e5d4991b9815dcfc25d2f1f}"
CLOUDFLARE_EXPOSED_CREDENTIALS_RULESET_ID="${CLOUDFLARE_EXPOSED_CREDENTIALS_RULESET_ID:-c2e184081120413c86c3ab7e14069605}"

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

managed_rules_json() {
  jq -n \
    --arg cf_managed_id "$CLOUDFLARE_MANAGED_RULESET_ID" \
    --arg owasp_id "$CLOUDFLARE_OWASP_RULESET_ID" \
    --arg ec_id "$CLOUDFLARE_EXPOSED_CREDENTIALS_RULESET_ID" \
    --arg host_expr "$hostname_expression" \
    '[
      {
        ref: "dokumen_execute_cloudflare_managed_ruleset",
        description: "Dokumen: execute Cloudflare Managed Ruleset for production hostnames",
        expression: $host_expr,
        action: "execute",
        action_parameters: {id: $cf_managed_id},
        enabled: true
      },
      {
        ref: "dokumen_execute_owasp_core_ruleset",
        description: "Dokumen: execute OWASP Core Ruleset (Paranoia Level 2) for production hostnames",
        expression: $host_expr,
        action: "execute",
        action_parameters: {
          id: $owasp_id,
          overrides: {
            categories: [
              {category: "paranoia-level-3", enabled: false},
              {category: "paranoia-level-4", enabled: false}
            ]
          }
        },
        enabled: true
      },
      {
        ref: "dokumen_execute_exposed_credentials_check",
        description: "Dokumen: execute Exposed Credentials Check for production hostnames",
        expression: $host_expr,
        action: "execute",
        action_parameters: {id: $ec_id},
        enabled: true
      }
    ]'
}

enable_leaked_credentials_detection() {
  if cf_api POST "/zones/${CLOUDFLARE_ZONE_ID}/leaked-credential-checks" '{"enabled": true}' >/dev/null; then
    echo "Enabled Leaked Credentials Detection." >&2
  else
    echo "Warning: failed to enable Leaked Credentials Detection. Your zone plan may not support it." >&2
  fi
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
  echo "Would enable Leaked Credentials Detection." >&2

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

enable_leaked_credentials_detection

echo "Cloudflare WAF setup complete (Pro plan)." >&2

printf 'CLOUDFLARE_WAF_CUSTOM_RULESET_ID=%s\n' "$custom_ruleset_id"
printf 'CLOUDFLARE_WAF_MANAGED_RULESET_ID=%s\n' "$managed_ruleset_id"
printf 'CLOUDFLARE_WAF_RATELIMIT_RULESET_ID=%s\n' "$rate_limit_ruleset_id"
