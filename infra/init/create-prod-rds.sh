#!/usr/bin/env bash
# Create or update the production RDS instance and the minimum networking it needs.

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
require_env PROD_RDS_MASTER_PASSWORD

MY_IP="$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')/32"

echo ">>> Production RDS networking"

VPC_ID="$(get_single_id_by_name ec2 describe-vpcs "$VPC_NAME" 'Vpcs[0].VpcId')"
if [ -z "$VPC_ID" ]; then
  VPC_ID=$(aws_region ec2 create-vpc \
    --cidr-block "$VPC_CIDR" \
    --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${VPC_NAME}}]" \
    --query 'Vpc.VpcId' \
    --output text)
fi
aws_region ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-hostnames '{"Value":true}'
echo "    VPC: $VPC_ID"

AZ="$(get_availability_zone 0)"
AZ_2="$(get_availability_zone 1)"
SUBNET_ID="$(ensure_public_subnet "$VPC_ID" "$SUBNET_NAME" "$PUBLIC_SUBNET_CIDR" "$AZ")"
SUBNET_2_ID="$(ensure_public_subnet "$VPC_ID" "$SUBNET_2_NAME" "$PUBLIC_SUBNET_2_CIDR" "$AZ_2")"
echo "    Public subnet: $SUBNET_ID"
echo "    Public subnet 2: $SUBNET_2_ID"

IGW_ID="$(get_single_id_by_name ec2 describe-internet-gateways "$IGW_NAME" 'InternetGateways[0].InternetGatewayId')"
if [ -z "$IGW_ID" ]; then
  IGW_ID=$(aws_region ec2 create-internet-gateway \
    --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${IGW_NAME}}]" \
    --query 'InternetGateway.InternetGatewayId' \
    --output text)
fi
aws_region ec2 attach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID" >/dev/null 2>&1 || true
echo "    Internet gateway: $IGW_ID"

ROUTE_TABLE_ID="$(get_single_id_by_name ec2 describe-route-tables "$ROUTE_TABLE_NAME" 'RouteTables[0].RouteTableId')"
if [ -z "$ROUTE_TABLE_ID" ]; then
  ROUTE_TABLE_ID=$(aws_region ec2 create-route-table \
    --vpc-id "$VPC_ID" \
    --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${ROUTE_TABLE_NAME}}]" \
    --query 'RouteTable.RouteTableId' \
    --output text)
fi
aws_region ec2 create-route \
  --route-table-id "$ROUTE_TABLE_ID" \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id "$IGW_ID" >/dev/null 2>&1 || true
ensure_route_table_association "$ROUTE_TABLE_ID" "$SUBNET_ID"
ensure_route_table_association "$ROUTE_TABLE_ID" "$SUBNET_2_ID"
echo "    Route table: $ROUTE_TABLE_ID"

SG_ID="$(ensure_security_group "$SG_NAME" "Dokumen EC2 reverse proxy and SSH" "$VPC_ID")"
RDS_SG_ID="$(ensure_security_group "$PROD_RDS_SG_NAME" "Dokumen production Postgres" "$VPC_ID")"
authorize_tcp_from_sg "$RDS_SG_ID" "$RDS_PORT" "$SG_ID"
if [ "$PROD_RDS_ALLOW_LOCAL_ADMIN" = "1" ]; then
  authorize_tcp_from_cidr "$RDS_SG_ID" "$RDS_PORT" "$MY_IP"
fi
echo "    EC2 security group: $SG_ID"
echo "    RDS security group: $RDS_SG_ID"
echo "    Local admin CIDR: $MY_IP"

ensure_db_subnet_group \
  "$PROD_RDS_SUBNET_GROUP_NAME" \
  "Dokumen production RDS public subnets" \
  "$SUBNET_ID" "$SUBNET_2_ID"
echo "    DB subnet group: $PROD_RDS_SUBNET_GROUP_NAME"

echo ""
echo ">>> Production RDS instance"
ensure_postgres_rds_instance \
  "$PROD_RDS_IDENTIFIER" \
  "$PROD_RDS_SUBNET_GROUP_NAME" \
  "$RDS_SG_ID" \
  "$PROD_RDS_MASTER_PASSWORD" \
  true \
  "$(bool_flag "$RDS_DELETION_PROTECTION")"

PROD_RDS_HOST="$(get_rds_endpoint "$PROD_RDS_IDENTIFIER")"
echo "    RDS endpoint: $PROD_RDS_HOST"

if [ -n "${AUTH_ROLE_PASSWORD:-}" ] &&
  [ -n "${WEB_USER_PASSWORD:-}" ] &&
  [ -n "${API_USER_PASSWORD:-}" ] &&
  [ -n "${WORKERS_USER_PASSWORD:-}" ]; then
  ensure_secret_drafts
  set_secret_draft_value prod-web.json DATABASE_URL "$(postgres_url web_user "$WEB_USER_PASSWORD" "$PROD_RDS_HOST" "$RDS_DB_NAME")"
  set_secret_draft_value prod-web.json WEB_DATABASE_URL "$(postgres_url web_user "$WEB_USER_PASSWORD" "$PROD_RDS_HOST" "$RDS_DB_NAME")"
  set_secret_draft_value prod-web.json AUTH_DATABASE_URL "$(postgres_url auth_role "$AUTH_ROLE_PASSWORD" "$PROD_RDS_HOST" "$RDS_DB_NAME")"
  set_secret_draft_value prod-api.json API_DATABASE_URL "$(postgres_url api_user "$API_USER_PASSWORD" "$PROD_RDS_HOST" "$RDS_DB_NAME")"
  set_secret_draft_value prod-workers.json WORKERS_DATABASE_URL "$(postgres_url workers_user "$WORKERS_USER_PASSWORD" "$PROD_RDS_HOST" "$RDS_DB_NAME")"
  echo "    Updated local secret drafts with production DB URLs."
else
  echo "    Skipped DB URL draft updates; set AUTH_ROLE_PASSWORD, WEB_USER_PASSWORD,"
  echo "    API_USER_PASSWORD, and WORKERS_USER_PASSWORD to patch local secret drafts."
fi

cat <<EOF

Production RDS is ready.

Export these before running db/deploy-rds:
  export RDS_HOST=$PROD_RDS_HOST
  export RDS_DB=$RDS_DB_NAME
  export RDS_ADMIN_USER=$RDS_MASTER_USERNAME
  export PGPASSWORD=<PROD_RDS_MASTER_PASSWORD>
  export PGSSLMODE=require
EOF
