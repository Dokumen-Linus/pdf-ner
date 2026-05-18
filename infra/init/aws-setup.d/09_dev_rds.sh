#!/usr/bin/env bash
# shellcheck disable=SC2153

setup_dev_rds() {
  if [ "$CREATE_DEV_RDS" != "1" ]; then
    echo ""
  echo ">>> Development RDS"
    echo "    CREATE_DEV_RDS=0, skipped development RDS setup."
    return
  fi

  echo ""
  echo ">>> 9. Development RDS"
  validate_rds_master_password DEV_RDS_MASTER_PASSWORD
  refresh_current_admin_ip

  DEV_VPC_ID="$(get_single_id_by_name ec2 describe-vpcs "$DEV_VPC_NAME" 'Vpcs[0].VpcId')"
  if [ -z "$DEV_VPC_ID" ]; then
    DEV_VPC_ID=$(aws_region ec2 create-vpc \
      --cidr-block "$DEV_VPC_CIDR" \
      --tag-specifications "$(default_ec2_tag_spec vpc "$DEV_VPC_NAME")" \
      --query 'Vpc.VpcId' \
      --output text)
  fi
  tag_ec2_resource "$DEV_VPC_ID" "$DEV_VPC_NAME"
  tag_vpc_default_resources "$DEV_VPC_ID" "$DEV_PROJECT_NAME"
  aws_region ec2 modify-vpc-attribute --vpc-id "$DEV_VPC_ID" --enable-dns-hostnames '{"Value":true}'
  echo "    VPC: $DEV_VPC_ID"

  DEV_AZ="$(get_availability_zone 0)"
  DEV_AZ_2="$(get_availability_zone 1)"
  DEV_SUBNET_1_ID="$(ensure_public_subnet "$DEV_VPC_ID" "$DEV_SUBNET_1_NAME" "$DEV_PUBLIC_SUBNET_1_CIDR" "$DEV_AZ")"
  DEV_SUBNET_2_ID="$(ensure_public_subnet "$DEV_VPC_ID" "$DEV_SUBNET_2_NAME" "$DEV_PUBLIC_SUBNET_2_CIDR" "$DEV_AZ_2")"
  echo "    Public subnet: $DEV_SUBNET_1_ID"
  echo "    Public subnet 2: $DEV_SUBNET_2_ID"

  DEV_IGW_ID="$(get_single_id_by_name ec2 describe-internet-gateways "$DEV_IGW_NAME" 'InternetGateways[0].InternetGatewayId')"
  if [ -z "$DEV_IGW_ID" ]; then
    DEV_IGW_ID=$(aws_region ec2 create-internet-gateway \
      --tag-specifications "$(default_ec2_tag_spec internet-gateway "$DEV_IGW_NAME")" \
      --query 'InternetGateway.InternetGatewayId' \
      --output text)
  fi
  tag_ec2_resource "$DEV_IGW_ID" "$DEV_IGW_NAME"
  aws_region ec2 attach-internet-gateway --internet-gateway-id "$DEV_IGW_ID" --vpc-id "$DEV_VPC_ID" >/dev/null 2>&1 || true
  echo "    Internet gateway: $DEV_IGW_ID"

  DEV_ROUTE_TABLE_ID="$(get_single_id_by_name ec2 describe-route-tables "$DEV_ROUTE_TABLE_NAME" 'RouteTables[0].RouteTableId')"
  if [ -z "$DEV_ROUTE_TABLE_ID" ]; then
    DEV_ROUTE_TABLE_ID=$(aws_region ec2 create-route-table \
      --vpc-id "$DEV_VPC_ID" \
      --tag-specifications "$(default_ec2_tag_spec route-table "$DEV_ROUTE_TABLE_NAME")" \
      --query 'RouteTable.RouteTableId' \
      --output text)
  fi
  tag_ec2_resource "$DEV_ROUTE_TABLE_ID" "$DEV_ROUTE_TABLE_NAME"
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

  ensure_postgres_rds_instance \
    "$DEV_RDS_IDENTIFIER" \
    "$DEV_RDS_SUBNET_GROUP_NAME" \
    "$DEV_RDS_SG_ID" \
    "$DEV_RDS_MASTER_PASSWORD" \
    true \
    "$(bool_flag "$RDS_DELETION_PROTECTION")" \
    false

  DEV_RDS_HOST="$(get_rds_endpoint "$DEV_RDS_IDENTIFIER")"
  echo "    RDS endpoint: $DEV_RDS_HOST"
}
