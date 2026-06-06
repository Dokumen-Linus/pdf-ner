#!/usr/bin/env bash

DEV_CIDRS_BASE_POLICY_FILE="${DEV_CIDRS_BASE_POLICY_FILE:-${SCRIPT_DIR}/base-policy.json}"

configure_dev_cidr_defaults() {
  configure_common_defaults

  RDS_PORT="${RDS_PORT:-5432}"
  DEV_RDS_SG_NAME="${DEV_RDS_SG_NAME:-${PROJECT_NAME}-dev-rds-sg}"
  DEV_CIDR="${DEV_CIDR:-}"
  PREVIOUS_DEV_CIDR="${PREVIOUS_DEV_CIDR:-}"
  DEV_IPV6_CIDR="${DEV_IPV6_CIDR:-}"
  PREVIOUS_DEV_IPV6_CIDR="${PREVIOUS_DEV_IPV6_CIDR:-}"
  DEV_SECRETS_POLICY_NAME="${DEV_SECRETS_POLICY_NAME:-${PROJECT_NAME}-dev-local-secrets-read}"
}

require_cidr() {
  local name="$1"
  local cidr="$2"
  local ip octet first second third fourth

  if [[ ! "$cidr" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$ ]]; then
    echo "${name} must be an IPv4 CIDR block, for example 203.0.113.10/32" >&2
    exit 1
  fi

  ip="${cidr%/*}"
  IFS=. read -r first second third fourth <<< "$ip"
  for octet in "$first" "$second" "$third" "$fourth"; do
    if ((10#$octet > 255)); then
      echo "${name} contains an invalid IPv4 octet: ${octet}" >&2
      exit 1
    fi
  done
}

require_ipv6_cidr() {
  local name="$1"
  local cidr="$2"
  local prefix

  prefix="${cidr##*/}"
  if [[ "$cidr" != */* ]] || [[ "$cidr" != *:* ]] || ! [[ "$prefix" =~ ^[0-9]+$ ]] || ((prefix > 128)); then
    echo "${name} must be an IPv6 CIDR block, for example 2001:db8::1/128" >&2
    exit 1
  fi
}

validate_dev_cidr_inputs() {
  : "${DEV_CIDR:?Set DEV_CIDR to the dev CIDR block to allow, for example 203.0.113.10/32}"

  require_cidr DEV_CIDR "$DEV_CIDR"
  if [ -n "$DEV_IPV6_CIDR" ]; then
    require_ipv6_cidr DEV_IPV6_CIDR "$DEV_IPV6_CIDR"
  fi
}

validate_dev_cidr_rotation_inputs() {
  : "${PREVIOUS_DEV_CIDR:?Set PREVIOUS_DEV_CIDR to the old dev CIDR block to remove, for example 203.0.113.10/32}"
  validate_dev_cidr_inputs
  require_cidr PREVIOUS_DEV_CIDR "$PREVIOUS_DEV_CIDR"
  if [ -n "$PREVIOUS_DEV_IPV6_CIDR" ]; then
    require_ipv6_cidr PREVIOUS_DEV_IPV6_CIDR "$PREVIOUS_DEV_IPV6_CIDR"
  fi
}

resolve_dev_rds_security_group_id() {
  local group_id="${DEV_RDS_SG_ID:-}"

  if [ -n "$group_id" ]; then
    printf '%s' "$group_id"
    return
  fi

  if [ -z "$DEV_RDS_SG_NAME" ] || [ -z "${DEV_VPC_ID:-}" ]; then
    echo "Missing development RDS security group id. Set DEV_RDS_SG_ID, or set DEV_RDS_SG_NAME and DEV_VPC_ID." >&2
    exit 1
  fi

  group_id="$(get_security_group_id "$DEV_RDS_SG_NAME" "$DEV_VPC_ID")"
  if [ -z "$group_id" ]; then
    echo "Could not find development RDS security group named ${DEV_RDS_SG_NAME} in ${DEV_VPC_ID}" >&2
    exit 1
  fi

  printf '%s' "$group_id"
}

get_tcp_cidr_rule_id() {
  local group_id="$1"
  local port="$2"
  local cidr="$3"

  aws_region ec2 describe-security-group-rules \
    --filters "Name=group-id,Values=${group_id}" \
    --query "SecurityGroupRules[?IsEgress==\`false\` && IpProtocol==\`tcp\` && FromPort==\`${port}\` && ToPort==\`${port}\` && CidrIpv4=='${cidr}'].SecurityGroupRuleId | [0]" \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }'
}

get_tcp_ipv6_cidr_rule_id() {
  local group_id="$1"
  local port="$2"
  local cidr="$3"

  aws_region ec2 describe-security-group-rules \
    --filters "Name=group-id,Values=${group_id}" \
    --query "SecurityGroupRules[?IsEgress==\`false\` && IpProtocol==\`tcp\` && FromPort==\`${port}\` && ToPort==\`${port}\` && CidrIpv6=='${cidr}'].SecurityGroupRuleId | [0]" \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }'
}

get_tcp_cidr_rule_ids() {
  local group_id="$1"
  local port="$2"

  aws_region ec2 describe-security-group-rules \
    --filters "Name=group-id,Values=${group_id}" \
    --query "SecurityGroupRules[?IsEgress==\`false\` && IpProtocol==\`tcp\` && FromPort==\`${port}\` && ToPort==\`${port}\` && (CidrIpv4!=\`null\` || CidrIpv6!=\`null\`)].SecurityGroupRuleId" \
    --output text
}

get_tcp_ipv4_cidrs() {
  local group_id="$1"
  local port="$2"

  aws_region ec2 describe-security-group-rules \
    --filters "Name=group-id,Values=${group_id}" \
    --query "SecurityGroupRules[?IsEgress==\`false\` && IpProtocol==\`tcp\` && FromPort==\`${port}\` && ToPort==\`${port}\` && CidrIpv4!=\`null\`].CidrIpv4" \
    --output text | tr '\t' '\n' | awk 'NF { print }'
}

get_tcp_ipv6_cidrs() {
  local group_id="$1"
  local port="$2"

  aws_region ec2 describe-security-group-rules \
    --filters "Name=group-id,Values=${group_id}" \
    --query "SecurityGroupRules[?IsEgress==\`false\` && IpProtocol==\`tcp\` && FromPort==\`${port}\` && ToPort==\`${port}\` && CidrIpv6!=\`null\`].CidrIpv6" \
    --output text | tr '\t' '\n' | awk 'NF { print }'
}

print_cidr_list() {
  local label="$1"
  local cidrs="$2"

  echo "${label}:"
  if [ -z "$cidrs" ]; then
    echo "  (none)"
    return
  fi

  printf '%s\n' "$cidrs" | sort -u | sed 's/^/  /'
}

show_dev_db_allowed_cidrs() {
  local group_id="$1"
  local port="$2"
  local ipv4_cidrs ipv6_cidrs

  ipv4_cidrs="$(get_tcp_ipv4_cidrs "$group_id" "$port")"
  ipv6_cidrs="$(get_tcp_ipv6_cidrs "$group_id" "$port")"

  echo "Development RDS ${group_id} tcp/${port} allowed CIDRs"
  print_cidr_list "IPv4" "$ipv4_cidrs"
  print_cidr_list "IPv6" "$ipv6_cidrs"
}

authorize_dev_db_cidr() {
  local group_id="$1"
  local port="$2"
  local cidr="$3"

  if [ -n "$(get_tcp_cidr_rule_id "$group_id" "$port" "$cidr")" ]; then
    echo "Development RDS ${group_id} already allows tcp/${port} from ${cidr}"
    return
  fi

  aws_region ec2 authorize-security-group-ingress \
    --group-id "$group_id" \
    --protocol tcp \
    --port "$port" \
    --cidr "$cidr" >/dev/null
  echo "Added development RDS ${group_id} tcp/${port} access from ${cidr}"
}

authorize_dev_db_ipv6_cidr() {
  local group_id="$1"
  local port="$2"
  local cidr="$3"

  if [ -z "$cidr" ]; then
    return
  fi

  if [ -n "$(get_tcp_ipv6_cidr_rule_id "$group_id" "$port" "$cidr")" ]; then
    echo "Development RDS ${group_id} already allows tcp/${port} from ${cidr}"
    return
  fi

  aws_region ec2 authorize-security-group-ingress \
    --group-id "$group_id" \
    --ip-permissions "IpProtocol=tcp,FromPort=${port},ToPort=${port},Ipv6Ranges=[{CidrIpv6=${cidr}}]" >/dev/null
  echo "Added development RDS ${group_id} tcp/${port} access from ${cidr}"
}

authorize_dev_db_cidrs() {
  local group_id="$1"
  local port="$2"

  authorize_dev_db_cidr "$group_id" "$port" "$DEV_CIDR"
  authorize_dev_db_ipv6_cidr "$group_id" "$port" "$DEV_IPV6_CIDR"
}

revoke_dev_db_cidr() {
  local group_id="$1"
  local port="$2"
  local cidr="$3"
  local rule_id

  rule_id="$(get_tcp_cidr_rule_id "$group_id" "$port" "$cidr")"
  if [ -z "$rule_id" ]; then
    echo "Development RDS ${group_id} had no tcp/${port} access from ${cidr}"
    return
  fi

  aws_region ec2 revoke-security-group-ingress \
    --group-id "$group_id" \
    --security-group-rule-ids "$rule_id" >/dev/null
  echo "Removed development RDS ${group_id} tcp/${port} access from ${cidr}"
}

revoke_dev_db_ipv6_cidr() {
  local group_id="$1"
  local port="$2"
  local cidr="$3"
  local rule_id

  if [ -z "$cidr" ]; then
    return
  fi

  rule_id="$(get_tcp_ipv6_cidr_rule_id "$group_id" "$port" "$cidr")"
  if [ -z "$rule_id" ]; then
    echo "Development RDS ${group_id} had no tcp/${port} access from ${cidr}"
    return
  fi

  aws_region ec2 revoke-security-group-ingress \
    --group-id "$group_id" \
    --security-group-rule-ids "$rule_id" >/dev/null
  echo "Removed development RDS ${group_id} tcp/${port} access from ${cidr}"
}

rotate_dev_db_cidrs() {
  local group_id="$1"
  local port="$2"

  revoke_dev_db_cidr "$group_id" "$port" "$PREVIOUS_DEV_CIDR"
  revoke_dev_db_ipv6_cidr "$group_id" "$port" "$PREVIOUS_DEV_IPV6_CIDR"
  authorize_dev_db_cidrs "$group_id" "$port"
}

clear_dev_db_cidrs() {
  local group_id="$1"
  local port="$2"
  local rule_ids rule_id

  rule_ids="$(get_tcp_cidr_rule_ids "$group_id" "$port")"
  for rule_id in $rule_ids; do
    aws_region ec2 revoke-security-group-ingress \
      --group-id "$group_id" \
      --security-group-rule-ids "$rule_id" >/dev/null
  done

  authorize_dev_db_cidrs "$group_id" "$port"
  if [ -n "$DEV_IPV6_CIDR" ]; then
    echo "Cleared development RDS ${group_id} tcp/${port} CIDRs; left required DEV_CIDR ${DEV_CIDR} and DEV_IPV6_CIDR ${DEV_IPV6_CIDR}"
  else
    echo "Cleared development RDS ${group_id} tcp/${port} CIDRs; left required DEV_CIDR ${DEV_CIDR}"
  fi
}

dev_secret_resources_json() {
  local account_id="$1"

  printf '[\n'
  printf '  "arn:aws:secretsmanager:%s:%s:secret:dev/web-*",\n' "$AWS_REGION" "$account_id"
  printf '  "arn:aws:secretsmanager:%s:%s:secret:dev/email-*",\n' "$AWS_REGION" "$account_id"
  printf '  "arn:aws:secretsmanager:%s:%s:secret:dev/api-*",\n' "$AWS_REGION" "$account_id"
  printf '  "arn:aws:secretsmanager:%s:%s:secret:dev/workers-*",\n' "$AWS_REGION" "$account_id"
  printf '  "arn:aws:secretsmanager:%s:%s:secret:dev/runpod-*"\n' "$AWS_REGION" "$account_id"
  printf ']\n'
}

base_policy_document() {
  local resources_json="$1"

  jq -c \
    --argjson resources "$resources_json" \
    '.Statement[0].Resource = $resources' \
    "$DEV_CIDRS_BASE_POLICY_FILE"
}

get_policy_arn() {
  aws iam list-policies \
    --scope Local \
    --query "Policies[?PolicyName=='${DEV_SECRETS_POLICY_NAME}'].Arn | [0]" \
    --output text | awk 'NF && $1 != "None" { print $1; exit }'
}

ensure_policy_version_limit() {
  local policy_arn="$1"
  local version_count oldest_non_default_version

  version_count="$(aws iam list-policy-versions \
    --policy-arn "$policy_arn" \
    --query 'length(Versions)' \
    --output text)"

  if [ "$version_count" -lt 5 ]; then
    return
  fi

  oldest_non_default_version="$(aws iam list-policy-versions \
    --policy-arn "$policy_arn" \
    --query "sort_by(Versions[?IsDefaultVersion==\`false\`], &CreateDate)[0].VersionId" \
    --output text)"

  if [ -n "$oldest_non_default_version" ] && [ "$oldest_non_default_version" != "None" ]; then
    aws iam delete-policy-version \
      --policy-arn "$policy_arn" \
      --version-id "$oldest_non_default_version"
  fi
}

build_dev_secrets_policy_document() {
  local account_id resources_json

  account_id="$(aws sts get-caller-identity --query Account --output text)"
  resources_json="$(dev_secret_resources_json "$account_id")"
  base_policy_document "$resources_json"
}

write_dev_secrets_policy_version() {
  local policy_document="$1"
  local policy_arn tag_args
  tag_args=("Key=Name,Value=${DEV_SECRETS_POLICY_NAME}" "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=${ENVIRONMENT}")

  policy_arn="$(get_policy_arn)"
  if [ -z "$policy_arn" ]; then
    policy_arn="$(aws iam create-policy \
      --policy-name "$DEV_SECRETS_POLICY_NAME" \
      --policy-document "$policy_document" \
      --tags "${tag_args[@]}" \
      --query 'Policy.Arn' \
      --output text)"
  else
    ensure_policy_version_limit "$policy_arn"
    aws iam create-policy-version \
      --policy-arn "$policy_arn" \
      --policy-document "$policy_document" \
      --set-as-default >/dev/null
    aws iam tag-policy \
      --policy-arn "$policy_arn" \
      --tags "${tag_args[@]}" >/dev/null
  fi

  printf '%s' "$policy_arn"
}

attach_dev_secrets_policy_if_requested() {
  local policy_arn="$1"

  if [ -n "${DEV_SECRETS_IAM_USER_NAME:-}" ]; then
    aws iam attach-user-policy \
      --user-name "$DEV_SECRETS_IAM_USER_NAME" \
      --policy-arn "$policy_arn"
    echo "Attached development secrets read policy to IAM user ${DEV_SECRETS_IAM_USER_NAME}"
  fi

  if [ -n "${DEV_SECRETS_IAM_ROLE_NAME:-}" ]; then
    aws iam attach-role-policy \
      --role-name "$DEV_SECRETS_IAM_ROLE_NAME" \
      --policy-arn "$policy_arn"
    echo "Attached development secrets read policy to IAM role ${DEV_SECRETS_IAM_ROLE_NAME}"
  fi

  if [ -z "${DEV_SECRETS_IAM_USER_NAME:-}" ] && [ -z "${DEV_SECRETS_IAM_ROLE_NAME:-}" ]; then
    echo "Set DEV_SECRETS_IAM_USER_NAME or DEV_SECRETS_IAM_ROLE_NAME to attach it automatically."
  fi
}

ensure_dev_secrets_policy() {
  local policy_arn policy_document

  policy_document="$(build_dev_secrets_policy_document)"
  policy_arn="$(write_dev_secrets_policy_version "$policy_document")"
  echo "Development secrets read policy allows configured dev secret resources through IAM identity only: ${policy_arn}"
  attach_dev_secrets_policy_if_requested "$policy_arn"
}

require_dev_secrets_policy_exists() {
  local policy_arn
  policy_arn="$(get_policy_arn)"
  if [ -z "$policy_arn" ]; then
    echo "ERROR: development secrets read policy does not exist: ${DEV_SECRETS_POLICY_NAME}" >&2
    exit 1
  fi
}

clear_dev_secrets_policy() {
  require_dev_secrets_policy_exists
  ensure_dev_secrets_policy
}
