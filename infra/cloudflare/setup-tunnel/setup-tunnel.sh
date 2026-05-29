#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/shared/load-env-file.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../shared/load-env-file.sh"
ENV_FILE_ARG="${1:-}"

# shellcheck source=infra/cloudflare/shared/cf-api.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../shared/cf-api.sh"

load_env_file "${LOCAL_ENV_FILE:-${ENV_FILE_ARG:-${SCRIPT_DIR}/.env.local}}"

CF_API_BASE="${CF_API_BASE:-https://api.cloudflare.com/client/v4}"
TUNNEL_NAME="${TUNNEL_NAME:-dokumen-prod}"
PUBLIC_HOSTNAMES="${PUBLIC_HOSTNAMES:-dokumenai.dev www.dokumenai.dev}"
TUNNEL_SERVICE_URL="${TUNNEL_SERVICE_URL:-http://localhost:3000}"

required_vars=(
  CLOUDFLARE_API_TOKEN
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_ZONE_ID
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "${var_name} is required."
    exit 1
  fi
done
echo "Required Cloudflare environment variables are present." >&2

for command_name in curl jq; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "${command_name} is required."
    exit 1
  fi
done
echo "Required local commands are available: curl jq." >&2

find_tunnel_id() {
  local response
  response="$(cf_api GET "/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel?is_deleted=false&per_page=100")" || return
  jq -r --arg name "$TUNNEL_NAME" '.result[]? | select(.name == $name and .deleted_at == null) | .id' <<< "$response" | head -n 1
}

create_tunnel() {
  local body response
  body="$(jq -n --arg name "$TUNNEL_NAME" '{name: $name, config_src: "cloudflare"}')"
  response="$(cf_api POST "/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel" "$body")" || return
  jq -r '[.result.id, (.result.token // .result.tunnel_token // "")] | @tsv' <<< "$response"
}

put_tunnel_config() {
  local tunnel_id="$1"
  local hostnames_json body

  hostnames_json="$(
    tr ' ' '\n' <<< "$PUBLIC_HOSTNAMES" \
      | sed '/^$/d' \
      | jq -R . \
      | jq -s .
  )"

  body="$(
    jq -n \
      --arg service "$TUNNEL_SERVICE_URL" \
      --argjson hostnames "$hostnames_json" \
      '{
        config: {
          ingress: (
            [$hostnames[] | {hostname: ., service: $service, originRequest: {}}]
            + [{service: "http_status:404"}]
          )
        }
      }'
  )"

  cf_api PUT "/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${tunnel_id}/configurations" "$body" >/dev/null
  echo "Updated Cloudflare Tunnel ingress configuration for '${TUNNEL_NAME}'." >&2
}

upsert_dns_record() {
  local hostname="$1"
  local tunnel_id="$2"
  local target="${tunnel_id}.cfargotunnel.com"
  local list_response record_id body

  list_response="$(cf_api GET "/zones/${CLOUDFLARE_ZONE_ID}/dns_records?name=${hostname}&per_page=100")" || return
  record_id="$(jq -r '.result[0].id // empty' <<< "$list_response")"
  body="$(
    jq -n \
      --arg name "$hostname" \
      --arg content "$target" \
      '{type: "CNAME", name: $name, content: $content, proxied: true, ttl: 1}'
  )"

  if [[ -n "$record_id" ]]; then
    cf_api PUT "/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${record_id}" "$body" >/dev/null
    echo "Updated DNS record for ${hostname}." >&2
  else
    cf_api POST "/zones/${CLOUDFLARE_ZONE_ID}/dns_records" "$body" >/dev/null
    echo "Created DNS record for ${hostname}." >&2
  fi
}

get_tunnel_token() {
  local tunnel_id="$1"
  local response
  response="$(cf_api GET "/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${tunnel_id}/token")" || return
  jq -er '
    if (.result | type) == "string" then
      .result
    else
      .result.token // .result.tunnel_token // empty
    end
  ' <<< "$response"
}

verify_cloudflare_token || exit 1

tunnel_token=""
tunnel_id="$(find_tunnel_id)" || exit 1
if [[ -n "$tunnel_id" ]]; then
  echo "Reusing Cloudflare Tunnel '${TUNNEL_NAME}' (${tunnel_id})." >&2
else
  create_output="$(create_tunnel)" || exit 1
  IFS=$'\t' read -r tunnel_id tunnel_token <<< "$create_output"
  if [[ -z "$tunnel_id" || "$tunnel_id" == "null" ]]; then
    echo "Cloudflare Tunnel create response did not include a tunnel id." >&2
    exit 1
  fi
  echo "Created Cloudflare Tunnel '${TUNNEL_NAME}' (${tunnel_id})." >&2
fi

put_tunnel_config "$tunnel_id"

read -r -a hostnames <<< "$PUBLIC_HOSTNAMES"
for hostname in "${hostnames[@]}"; do
  upsert_dns_record "$hostname" "$tunnel_id"
done

if [[ -z "$tunnel_token" || "$tunnel_token" == "null" ]]; then
  tunnel_token="$(get_tunnel_token "$tunnel_id")" || exit 1
  echo "Fetched Cloudflare Tunnel token from token endpoint." >&2
else
  echo "Using Cloudflare Tunnel token from create response." >&2
fi
if [[ -z "$tunnel_token" || "$tunnel_token" == "null" ]]; then
  echo "Cloudflare Tunnel token response did not include TUNNEL_TOKEN." >&2
  exit 1
fi
echo "Cloudflare Tunnel setup complete." >&2

printf 'TUNNEL_ID=%s\n' "$tunnel_id"
printf 'TUNNEL_TOKEN=%s\n' "$tunnel_token"
printf 'TUNNEL_TARGET=%s.cfargotunnel.com\n' "$tunnel_id"
