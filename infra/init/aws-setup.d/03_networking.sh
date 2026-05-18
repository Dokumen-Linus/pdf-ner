#!/usr/bin/env bash

setup_networking() {
  local key_pair_id default_sg_id
  echo ">>> VPC and networking"
  refresh_current_admin_ip
  require_setup_values "VPC flow logs" ACCOUNT_ID
  require_availability_zones 2

  VPC_ID="$(get_single_id_by_name ec2 describe-vpcs "$VPC_NAME" 'Vpcs[0].VpcId')"
  if [ -z "$VPC_ID" ]; then
    VPC_ID=$(aws_region ec2 create-vpc \
      --cidr-block "$VPC_CIDR" \
      --tag-specifications "$(default_ec2_tag_spec vpc "$VPC_NAME")" \
      --query 'Vpc.VpcId' \
      --output text)
  fi
  tag_ec2_resource "$VPC_ID" "$VPC_NAME"
  tag_vpc_default_resources "$VPC_ID" "$PROJECT_NAME"
  aws_region ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-hostnames '{"Value":true}'
  aws_region ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-support '{"Value":true}'
  echo "    VPC: $VPC_ID"

  AZ="$(get_availability_zone 0)"
  AZ_2="$(get_availability_zone 1)"
  SUBNET_ID="$(ensure_public_subnet "$VPC_ID" "$SUBNET_NAME" "$PUBLIC_SUBNET_CIDR" "$AZ")"
  SUBNET_2_ID="$(ensure_public_subnet "$VPC_ID" "$SUBNET_2_NAME" "$PUBLIC_SUBNET_2_CIDR" "$AZ_2")"
  PRIVATE_SUBNET_ID="$(ensure_private_subnet "$VPC_ID" "$PRIVATE_SUBNET_NAME" "$PRIVATE_SUBNET_CIDR" "$AZ")"
  PRIVATE_SUBNET_2_ID="$(ensure_private_subnet "$VPC_ID" "$PRIVATE_SUBNET_2_NAME" "$PRIVATE_SUBNET_2_CIDR" "$AZ_2")"
  echo "    Public subnet: $SUBNET_ID"
  echo "    Public subnet 2: $SUBNET_2_ID"
  echo "    Private subnet: $PRIVATE_SUBNET_ID"
  echo "    Private subnet 2: $PRIVATE_SUBNET_2_ID"

  IGW_ID="$(get_single_id_by_name ec2 describe-internet-gateways "$IGW_NAME" 'InternetGateways[0].InternetGatewayId')"
  if [ -z "$IGW_ID" ]; then
    IGW_ID=$(aws_region ec2 create-internet-gateway \
      --tag-specifications "$(default_ec2_tag_spec internet-gateway "$IGW_NAME")" \
      --query 'InternetGateway.InternetGatewayId' \
      --output text)
  fi
  tag_ec2_resource "$IGW_ID" "$IGW_NAME"
  aws_region ec2 attach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID" >/dev/null 2>&1 || true
  echo "    Internet gateway: $IGW_ID"

  ROUTE_TABLE_ID="$(get_single_id_by_name ec2 describe-route-tables "$ROUTE_TABLE_NAME" 'RouteTables[0].RouteTableId')"
  if [ -z "$ROUTE_TABLE_ID" ]; then
    ROUTE_TABLE_ID=$(aws_region ec2 create-route-table \
      --vpc-id "$VPC_ID" \
      --tag-specifications "$(default_ec2_tag_spec route-table "$ROUTE_TABLE_NAME")" \
      --query 'RouteTable.RouteTableId' \
      --output text)
  fi
  tag_ec2_resource "$ROUTE_TABLE_ID" "$ROUTE_TABLE_NAME"
  aws_region ec2 create-route \
    --route-table-id "$ROUTE_TABLE_ID" \
    --destination-cidr-block 0.0.0.0/0 \
    --gateway-id "$IGW_ID" >/dev/null 2>&1 || true
  ensure_route_table_association "$ROUTE_TABLE_ID" "$SUBNET_ID"
  ensure_route_table_association "$ROUTE_TABLE_ID" "$SUBNET_2_ID"
  echo "    Route table: $ROUTE_TABLE_ID"

  echo ""
  echo ">>> NAT gateways and private routes"
  NAT_EIP_ALLOC_ID="$(ensure_elastic_ip "$NAT_EIP_NAME")"
  NAT_2_EIP_ALLOC_ID="$(ensure_elastic_ip "$NAT_2_EIP_NAME")"
  NAT_GATEWAY_ID="$(ensure_nat_gateway "$NAT_GATEWAY_NAME" "$SUBNET_ID" "$NAT_EIP_ALLOC_ID")"
  NAT_GATEWAY_2_ID="$(ensure_nat_gateway "$NAT_GATEWAY_2_NAME" "$SUBNET_2_ID" "$NAT_2_EIP_ALLOC_ID")"
  PRIVATE_ROUTE_TABLE_ID="$(ensure_private_route_table "$VPC_ID" "$PRIVATE_ROUTE_TABLE_NAME" "$PRIVATE_SUBNET_ID" "$NAT_GATEWAY_ID")"
  PRIVATE_ROUTE_TABLE_2_ID="$(ensure_private_route_table "$VPC_ID" "$PRIVATE_ROUTE_TABLE_2_NAME" "$PRIVATE_SUBNET_2_ID" "$NAT_GATEWAY_2_ID")"
  echo "    NAT gateway: $NAT_GATEWAY_ID"
  echo "    NAT gateway 2: $NAT_GATEWAY_2_ID"
  echo "    Private route table: $PRIVATE_ROUTE_TABLE_ID"
  echo "    Private route table 2: $PRIVATE_ROUTE_TABLE_2_ID"

  echo ""
  echo ">>> Security group"

  SG_ID="$(ensure_security_group "$SG_NAME" "Dokumen EC2 reverse proxy and SSH" "$VPC_ID")"

  if [ "$EC2_SSH_ENABLED" = "1" ]; then
    authorize_tcp_from_cidr "$SG_ID" 22 "$MY_IP"
  fi
  authorize_tcp_from_cidr "$SG_ID" 80 0.0.0.0/0
  authorize_tcp_from_cidr "$SG_ID" 443 0.0.0.0/0
  authorize_tcp_from_cidr "$SG_ID" 81 "$MY_IP"
  default_sg_id=$(get_security_group_id default "$VPC_ID")
  if [ -n "$default_sg_id" ]; then
    revoke_default_security_group_ingress "$default_sg_id"
  fi
  echo "    Security group: $SG_ID"
  echo "    HTTP/HTTPS: 0.0.0.0/0 for public web traffic"
  echo "    Admin ports: $MY_IP"

  echo ""
  echo ">>> VPC flow logs"
  VPC_FLOW_LOG_ID="$(ensure_vpc_flow_logs "$VPC_ID")"
  echo "    Flow log: $VPC_FLOW_LOG_ID"
  echo "    Log group: $VPC_FLOW_LOG_GROUP_NAME"

  if [ "$EC2_SSH_ENABLED" = "1" ]; then
    echo ""
    echo ">>> SSH key pair"
    aws_region ec2 import-key-pair \
      --key-name "$KEY_NAME" \
      --tag-specifications "$(default_ec2_tag_spec key-pair "$KEY_NAME")" \
      --public-key-material "fileb://${SSH_PUBKEY_PATH}" >/dev/null 2>&1 || true
    key_pair_id="$(get_key_pair_id "$KEY_NAME")"
    if [ -n "$key_pair_id" ]; then
      tag_ec2_resource "$key_pair_id" "$KEY_NAME"
    fi
    echo "    Key pair: $KEY_NAME"
  else
    echo ""
    echo ">>> SSH key pair"
    echo "    EC2_SSH_ENABLED=0, skipped key pair import; use SSM Session Manager."
  fi
}
