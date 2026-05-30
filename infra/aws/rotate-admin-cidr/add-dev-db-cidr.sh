#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/aws/shared/common.sh
. "${SCRIPT_DIR}/../shared/common.sh"

load_env_file "${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
configure_common_defaults

RDS_PORT="${RDS_PORT:-5432}"
DEV_RDS_SG_NAME="${DEV_RDS_SG_NAME:-${PROJECT_NAME}-dev-rds-sg}"
DEV_DB_CIDR="${DEV_DB_CIDR:-${ADMIN_CIDR:-}}"

: "${DEV_DB_CIDR:?Set DEV_DB_CIDR to the dev DB CIDR block to allow, for example 203.0.113.10/32}"

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

resolve_security_group_id() {
  local label="$1"
  local group_id="$2"
  local group_name="$3"
  local vpc_id="$4"

  if [ -n "$group_id" ]; then
    printf '%s' "$group_id"
    return
  fi

  if [ -z "$group_name" ] || [ -z "$vpc_id" ]; then
    echo "Missing ${label} security group id. Set the explicit SG id, or set its name and VPC id." >&2
    exit 1
  fi

  group_id="$(get_security_group_id "$group_name" "$vpc_id")"
  if [ -z "$group_id" ]; then
    echo "Could not find ${label} security group named ${group_name} in ${vpc_id}" >&2
    exit 1
  fi

  printf '%s' "$group_id"
}

tcp_cidr_ingress_exists() {
  local group_id="$1"
  local port="$2"
  local cidr="$3"
  local rule_id

  rule_id="$(aws_region ec2 describe-security-group-rules \
    --filters "Name=group-id,Values=${group_id}" \
    --query "SecurityGroupRules[?IsEgress==\`false\` && IpProtocol==\`tcp\` && FromPort==\`${port}\` && ToPort==\`${port}\` && CidrIpv4=='${cidr}'].SecurityGroupRuleId | [0]" \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }')"

  [ -n "$rule_id" ]
}

authorize_dev_db_cidr() {
  local group_id="$1"
  local port="$2"
  local cidr="$3"

  if tcp_cidr_ingress_exists "$group_id" "$port" "$cidr"; then
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

require_cidr DEV_DB_CIDR "$DEV_DB_CIDR"

DEV_RDS_SECURITY_GROUP_ID="$(resolve_security_group_id "development RDS" "${DEV_RDS_SG_ID:-}" "$DEV_RDS_SG_NAME" "${DEV_VPC_ID:-}")"

echo "Adding development RDS CIDR access for ${PROJECT_NAME} in ${AWS_REGION}"
authorize_dev_db_cidr "$DEV_RDS_SECURITY_GROUP_ID" "$RDS_PORT" "$DEV_DB_CIDR"
echo "Development RDS CIDR update complete."
