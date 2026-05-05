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

  SUBNET_ID="$(get_single_id_by_name ec2 describe-subnets "$SUBNET_NAME" 'Subnets[0].SubnetId')"
  if [ -z "$SUBNET_ID" ]; then
    AZ="$(aws_region ec2 describe-availability-zones --query 'AvailabilityZones[0].ZoneName' --output text)"
    SUBNET_ID=$(aws_region ec2 create-subnet \
      --vpc-id "$VPC_ID" \
      --cidr-block "$PUBLIC_SUBNET_CIDR" \
      --availability-zone "$AZ" \
      --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${SUBNET_NAME}}]" \
      --query 'Subnet.SubnetId' \
      --output text)
  fi
  aws_region ec2 modify-subnet-attribute --subnet-id "$SUBNET_ID" --map-public-ip-on-launch
  echo "    Public subnet: $SUBNET_ID"

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
  aws_region ec2 associate-route-table --route-table-id "$ROUTE_TABLE_ID" --subnet-id "$SUBNET_ID" >/dev/null 2>&1 || true
  echo "    Route table: $ROUTE_TABLE_ID"

  echo ""
  echo ">>> 2. Security group"

  SG_ID="$(aws_region ec2 describe-security-groups \
    --filters "Name=group-name,Values=${SG_NAME}" "Name=vpc-id,Values=${VPC_ID}" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }')"

  if [ -z "$SG_ID" ]; then
    SG_ID=$(aws_region ec2 create-security-group \
      --group-name "$SG_NAME" \
      --description "Dokumen EC2 reverse proxy and SSH" \
      --vpc-id "$VPC_ID" \
      --query 'GroupId' \
      --output text)
    aws_region ec2 create-tags --resources "$SG_ID" --tags "Key=Name,Value=${SG_NAME}"
  fi

  aws_region ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 22 --cidr "$MY_IP" >/dev/null 2>&1 || true
  aws_region ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0 >/dev/null 2>&1 || true
  aws_region ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0 >/dev/null 2>&1 || true
  aws_region ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 81 --cidr "$MY_IP" >/dev/null 2>&1 || true
  echo "    Security group: $SG_ID"

  echo ""
  echo ">>> 3. SSH key pair"
  aws_region ec2 import-key-pair \
    --key-name "$KEY_NAME" \
    --public-key-material "fileb://${SSH_PUBKEY_PATH}" >/dev/null 2>&1 || true
  echo "    Key pair: $KEY_NAME"
}
