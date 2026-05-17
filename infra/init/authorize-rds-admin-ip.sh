#!/usr/bin/env bash
# Refresh local /32 Postgres ingress for the prod and dev RDS security groups.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETUP_PARTS_DIR="${SCRIPT_DIR}/aws-setup.d"

# shellcheck source=/dev/null
. "${SETUP_PARTS_DIR}/01_common.sh"

load_local_env
configure_defaults

require_cmd aws
require_cmd curl
require_cmd jq

MY_IP="$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')/32"

refresh_group() {
  local label="$1"
  local group_id="$2"

  if [ -z "$group_id" ]; then
    echo "    Skipping $label; security group not found."
    return
  fi

  local cidr
  while IFS= read -r cidr; do
    [ -n "$cidr" ] || continue
    [ "$cidr" = "$MY_IP" ] && continue
    aws_region ec2 revoke-security-group-ingress \
      --group-id "$group_id" \
      --protocol tcp \
      --port "$RDS_PORT" \
      --cidr "$cidr" >/dev/null 2>&1 || true
  done < <(
    aws_region ec2 describe-security-groups \
      --group-ids "$group_id" \
      --query "SecurityGroups[0].IpPermissions[?FromPort==\`${RDS_PORT}\` && ToPort==\`${RDS_PORT}\` && IpProtocol=='tcp'].IpRanges[].CidrIp" \
      --output text | tr '\t' '\n'
  )

  authorize_tcp_from_cidr "$group_id" "$RDS_PORT" "$MY_IP"
  echo "    $label allows $MY_IP on $RDS_PORT."
}

PROD_VPC_ID="$(get_single_id_by_name ec2 describe-vpcs "$VPC_NAME" 'Vpcs[0].VpcId')"
DEV_VPC_ID="$(get_single_id_by_name ec2 describe-vpcs "$DEV_VPC_NAME" 'Vpcs[0].VpcId')"

PROD_RDS_SG_ID=""
DEV_RDS_SG_ID=""

if [ -n "$PROD_VPC_ID" ]; then
  PROD_RDS_SG_ID="$(get_security_group_id "$PROD_RDS_SG_NAME" "$PROD_VPC_ID")"
fi
if [ -n "$DEV_VPC_ID" ]; then
  DEV_RDS_SG_ID="$(get_security_group_id "$DEV_RDS_SG_NAME" "$DEV_VPC_ID")"
fi

echo "Refreshing RDS admin ingress for current IP: $MY_IP"
refresh_group "$PROD_RDS_IDENTIFIER" "$PROD_RDS_SG_ID"
refresh_group "$DEV_RDS_IDENTIFIER" "$DEV_RDS_SG_ID"
