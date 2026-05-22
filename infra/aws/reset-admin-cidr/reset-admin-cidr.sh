#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/aws/shared/common.sh
. "${SCRIPT_DIR}/../shared/common.sh"

load_env_file "${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
configure_common_defaults

RDS_PORT="${RDS_PORT:-5432}"
SG_NAME="${SG_NAME:-${PROJECT_NAME}-ec2}"
PROD_RDS_SG_NAME="${PROD_RDS_SG_NAME:-${PROJECT_NAME}-prod-rds-sg}"
DEV_RDS_SG_NAME="${DEV_RDS_SG_NAME:-${PROJECT_NAME}-dev-rds-sg}"

: "${ADMIN_CIDR:?Set ADMIN_CIDR to the new admin CIDR block, for example 203.0.113.10/32}"

require_cidr() {
  local cidr="$1"
  local ip octet first second third fourth

  if [[ ! "$cidr" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$ ]]; then
    echo "ADMIN_CIDR must be an IPv4 CIDR block, for example 203.0.113.10/32" >&2
    exit 1
  fi

  ip="${cidr%/*}"
  IFS=. read -r first second third fourth <<< "$ip"
  for octet in "$first" "$second" "$third" "$fourth"; do
    if ((10#$octet > 255)); then
      echo "ADMIN_CIDR contains an invalid IPv4 octet: ${octet}" >&2
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

revoke_tcp_cidr_ingress_for_port() {
  local group_id="$1"
  local port="$2"
  local rule_ids rule_id

  rule_ids="$(aws_region ec2 describe-security-group-rules \
    --filters "Name=group-id,Values=${group_id}" \
    --query "SecurityGroupRules[?IsEgress==\`false\` && IpProtocol==\`tcp\` && FromPort==\`${port}\` && ToPort==\`${port}\` && CidrIpv4!=\`null\`].SecurityGroupRuleId" \
    --output text)"

  for rule_id in $rule_ids; do
    aws_region ec2 revoke-security-group-ingress \
      --group-id "$group_id" \
      --security-group-rule-ids "$rule_id" >/dev/null
  done
}

authorize_tcp_cidr_ingress_for_port() {
  local group_id="$1"
  local port="$2"

  aws_region ec2 authorize-security-group-ingress \
    --group-id "$group_id" \
    --protocol tcp \
    --port "$port" \
    --cidr "$ADMIN_CIDR" >/dev/null
}

reset_admin_tcp_port() {
  local label="$1"
  local group_id="$2"
  local port="$3"

  revoke_tcp_cidr_ingress_for_port "$group_id" "$port"
  authorize_tcp_cidr_ingress_for_port "$group_id" "$port"
  echo "Set ${label} ${group_id} tcp/${port} admin access to ${ADMIN_CIDR}"
}

require_cidr "$ADMIN_CIDR"

EC2_SG_ID="$(resolve_security_group_id "EC2" "${SG_ID:-}" "$SG_NAME" "${VPC_ID:-}")"
PROD_RDS_SECURITY_GROUP_ID="$(resolve_security_group_id "production RDS" "${RDS_SG_ID:-}" "$PROD_RDS_SG_NAME" "${VPC_ID:-}")"
DEV_RDS_SECURITY_GROUP_ID="$(resolve_security_group_id "development RDS" "${DEV_RDS_SG_ID:-}" "$DEV_RDS_SG_NAME" "${DEV_VPC_ID:-}")"

echo "Resetting admin CIDR access for ${PROJECT_NAME} in ${AWS_REGION}"
reset_admin_tcp_port "EC2 SSH" "$EC2_SG_ID" 22
reset_admin_tcp_port "production RDS" "$PROD_RDS_SECURITY_GROUP_ID" "$RDS_PORT"
reset_admin_tcp_port "development RDS" "$DEV_RDS_SECURITY_GROUP_ID" "$RDS_PORT"
echo "Admin CIDR reset complete."
