#!/usr/bin/env bash
# Create or update the public development RDS instance in a separate VPC.

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
require_env DEV_RDS_MASTER_PASSWORD

MY_IP="$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')/32"

echo ">>> Development RDS networking"

DEV_VPC_ID="$(get_single_id_by_name ec2 describe-vpcs "$DEV_VPC_NAME" 'Vpcs[0].VpcId')"
if [ -z "$DEV_VPC_ID" ]; then
  DEV_VPC_ID=$(aws_region ec2 create-vpc \
    --cidr-block "$DEV_VPC_CIDR" \
    --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${DEV_VPC_NAME}}]" \
    --query 'Vpc.VpcId' \
    --output text)
fi
aws_region ec2 modify-vpc-attribute --vpc-id "$DEV_VPC_ID" --enable-dns-hostnames '{"Value":true}'
echo "    VPC: $DEV_VPC_ID"

AZ="$(get_availability_zone 0)"
AZ_2="$(get_availability_zone 1)"
DEV_SUBNET_1_ID="$(ensure_public_subnet "$DEV_VPC_ID" "$DEV_SUBNET_1_NAME" "$DEV_PUBLIC_SUBNET_1_CIDR" "$AZ")"
DEV_SUBNET_2_ID="$(ensure_public_subnet "$DEV_VPC_ID" "$DEV_SUBNET_2_NAME" "$DEV_PUBLIC_SUBNET_2_CIDR" "$AZ_2")"
echo "    Public subnet: $DEV_SUBNET_1_ID"
echo "    Public subnet 2: $DEV_SUBNET_2_ID"

DEV_IGW_ID="$(get_single_id_by_name ec2 describe-internet-gateways "$DEV_IGW_NAME" 'InternetGateways[0].InternetGatewayId')"
if [ -z "$DEV_IGW_ID" ]; then
  DEV_IGW_ID=$(aws_region ec2 create-internet-gateway \
    --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${DEV_IGW_NAME}}]" \
    --query 'InternetGateway.InternetGatewayId' \
    --output text)
fi
aws_region ec2 attach-internet-gateway --internet-gateway-id "$DEV_IGW_ID" --vpc-id "$DEV_VPC_ID" >/dev/null 2>&1 || true
echo "    Internet gateway: $DEV_IGW_ID"

DEV_ROUTE_TABLE_ID="$(get_single_id_by_name ec2 describe-route-tables "$DEV_ROUTE_TABLE_NAME" 'RouteTables[0].RouteTableId')"
if [ -z "$DEV_ROUTE_TABLE_ID" ]; then
  DEV_ROUTE_TABLE_ID=$(aws_region ec2 create-route-table \
    --vpc-id "$DEV_VPC_ID" \
    --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${DEV_ROUTE_TABLE_NAME}}]" \
    --query 'RouteTable.RouteTableId' \
    --output text)
fi
aws_region ec2 create-route \
  --route-table-id "$DEV_ROUTE_TABLE_ID" \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id "$DEV_IGW_ID" >/dev/null 2>&1 || true
ensure_route_table_association "$DEV_ROUTE_TABLE_ID" "$DEV_SUBNET_1_ID"
ensure_route_table_association "$DEV_ROUTE_TABLE_ID" "$DEV_SUBNET_2_ID"
echo "    Route table: $DEV_ROUTE_TABLE_ID"

DEV_RDS_SG_ID="$(ensure_security_group "$DEV_RDS_SG_NAME" "Dokumen development Postgres" "$DEV_VPC_ID")"
authorize_tcp_from_cidr "$DEV_RDS_SG_ID" "$RDS_PORT" "$MY_IP"
echo "    RDS security group: $DEV_RDS_SG_ID"
echo "    Local admin CIDR: $MY_IP"

ensure_db_subnet_group \
  "$DEV_RDS_SUBNET_GROUP_NAME" \
  "Dokumen development RDS public subnets" \
  "$DEV_SUBNET_1_ID" "$DEV_SUBNET_2_ID"
echo "    DB subnet group: $DEV_RDS_SUBNET_GROUP_NAME"

echo ""
echo ">>> Development RDS instance"
ensure_postgres_rds_instance \
  "$DEV_RDS_IDENTIFIER" \
  "$DEV_RDS_SUBNET_GROUP_NAME" \
  "$DEV_RDS_SG_ID" \
  "$DEV_RDS_MASTER_PASSWORD" \
  true \
  "$(bool_flag "$RDS_DELETION_PROTECTION")"

DEV_RDS_HOST="$(get_rds_endpoint "$DEV_RDS_IDENTIFIER")"
echo "    RDS endpoint: $DEV_RDS_HOST"

cat <<EOF

Development RDS is ready.

Export these before running db/deploy-rds:
  export RDS_HOST=$DEV_RDS_HOST
  export RDS_DB=$RDS_DB_NAME
  export RDS_ADMIN_USER=$RDS_MASTER_USERNAME
  export PGPASSWORD=<DEV_RDS_MASTER_PASSWORD>
  export PGSSLMODE=require
EOF
