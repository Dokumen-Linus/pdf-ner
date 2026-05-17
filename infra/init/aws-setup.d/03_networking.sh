#!/usr/bin/env bash

setup_networking() {
  echo ">>> 1. VPC and networking"

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

  echo ""
  echo ">>> 2. Security group"

  SG_ID="$(ensure_security_group "$SG_NAME" "Dokumen EC2 reverse proxy and SSH" "$VPC_ID")"

  authorize_tcp_from_cidr "$SG_ID" 22 "$MY_IP"
  authorize_tcp_from_cidr "$SG_ID" 80 0.0.0.0/0
  authorize_tcp_from_cidr "$SG_ID" 443 0.0.0.0/0
  authorize_tcp_from_cidr "$SG_ID" 81 "$MY_IP"
  echo "    Security group: $SG_ID"

  echo ""
  echo ">>> 3. SSH key pair"
  aws_region ec2 import-key-pair \
    --key-name "$KEY_NAME" \
    --public-key-material "fileb://${SSH_PUBKEY_PATH}" >/dev/null 2>&1 || true
  echo "    Key pair: $KEY_NAME"
}
