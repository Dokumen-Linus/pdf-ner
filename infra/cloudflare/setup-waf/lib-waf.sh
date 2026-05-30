# shellcheck shell=bash
# WAF-specific helper functions for setup-waf-* scripts.
# Dependencies (sourced by the caller): cf-api.sh, load-env-file.sh

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
        expression: "(\($host_expr)) and http.request.method eq \"POST\" and http.request.uri.path eq \"/api/chat\"",
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
        expression: "(\($host_expr)) and http.request.method eq \"POST\" and http.request.uri.path eq \"/api/pdf-upload\"",
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
        expression: "(\($host_expr)) and http.request.method eq \"POST\" and http.request.uri.path eq \"/api/avatar-upload\"",
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
    existing_name="$(jq -r '.result.name' <<< "$entrypoint_response")"
    existing_rules="$(jq '.result.rules // []' <<< "$entrypoint_response")"
    merged_rules="$(merge_rules_by_ref "$existing_rules" "$managed_rules")"
    payload="$(phase_payload "$phase" "$existing_name" "$description" "$merged_rules")"
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
