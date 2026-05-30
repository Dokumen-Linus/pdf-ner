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

required_vars=(
  CLOUDFLARE_API_TOKEN
  CLOUDFLARE_ACCOUNT_ID
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "${var_name} is required."
    exit 1
  fi
done
echo "Required Cloudflare environment variables are present." >&2

for command_name in curl jq openssl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "${command_name} is required."
    exit 1
  fi
done
echo "Required local commands are available: curl jq openssl." >&2

find_tunnel_id() {
  local response
  response="$(cf_api GET "/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel?is_deleted=false&per_page=100")" || return
  jq -r --arg name "$TUNNEL_NAME" '.result[]? | select(.name == $name and .deleted_at == null) | .id' <<< "$response" | head -n 1
}

find_tunnel_name() {
  local tunnel_id="$1"
  local response
  response="$(cf_api GET "/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel?is_deleted=false&per_page=100")" || return
  jq -r --arg id "$tunnel_id" '.result[]? | select(.id == $id and .deleted_at == null) | .name' <<< "$response" | head -n 1
}

rotate_tunnel_token() {
  local tunnel_id="$1"
  local tunnel_name="$2"
  local tunnel_secret body

  tunnel_secret="$(openssl rand -base64 32)"
  body="$(
    jq -n \
      --arg name "$tunnel_name" \
      --arg tunnel_secret "$tunnel_secret" \
      '{name: $name, tunnel_secret: $tunnel_secret}'
  )"

  cf_api PATCH "/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${tunnel_id}" "$body" >/dev/null
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

tunnel_id="${TUNNEL_ID:-}"
if [[ -z "$tunnel_id" || "$tunnel_id" == "REPLACE_WITH_CLOUDFLARE_TUNNEL_ID" ]]; then
  tunnel_id="$(find_tunnel_id)" || exit 1
fi

if [[ -z "$tunnel_id" || "$tunnel_id" == "null" ]]; then
  echo "TUNNEL_ID is required, or TUNNEL_NAME must match an existing Cloudflare Tunnel." >&2
  exit 1
fi

tunnel_name="$(find_tunnel_name "$tunnel_id")" || exit 1
if [[ -z "$tunnel_name" || "$tunnel_name" == "null" ]]; then
  tunnel_name="$TUNNEL_NAME"
  echo "Could not find tunnel name from list response; using TUNNEL_NAME='${tunnel_name}'." >&2
fi

rotate_tunnel_token "$tunnel_id" "$tunnel_name" || exit 1

tunnel_token="$(get_tunnel_token "$tunnel_id")" || exit 1
if [[ -z "$tunnel_token" || "$tunnel_token" == "null" ]]; then
  echo "Cloudflare Tunnel rotate response did not include TUNNEL_TOKEN." >&2
  exit 1
fi

echo "Rotated Cloudflare Tunnel token for '${tunnel_name}' (${tunnel_id})." >&2

printf 'TUNNEL_ID=%s\n' "$tunnel_id"
printf 'TUNNEL_TOKEN=%s\n' "$tunnel_token"
