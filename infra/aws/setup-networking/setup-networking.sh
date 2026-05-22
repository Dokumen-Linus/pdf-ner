#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/deploy-aws/shared/common.sh
. "${SCRIPT_DIR}/../shared/common.sh"

load_env_file "${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
configure_common_defaults

VPC_CIDR="${VPC_CIDR:-10.40.0.0/16}"
PUBLIC_SUBNET_CIDR="${PUBLIC_SUBNET_CIDR:-10.40.1.0/24}"
PUBLIC_SUBNET_2_CIDR="${PUBLIC_SUBNET_2_CIDR:-10.40.2.0/24}"
PRIVATE_SUBNET_CIDR="${PRIVATE_SUBNET_CIDR:-10.40.101.0/24}"
PRIVATE_SUBNET_2_CIDR="${PRIVATE_SUBNET_2_CIDR:-10.40.102.0/24}"

VPC_NAME="${VPC_NAME:-${PROJECT_NAME}-vpc}"
SUBNET_NAME="${SUBNET_NAME:-${PROJECT_NAME}-public-a}"
SUBNET_2_NAME="${SUBNET_2_NAME:-${PROJECT_NAME}-public-b}"
PRIVATE_SUBNET_NAME="${PRIVATE_SUBNET_NAME:-${PROJECT_NAME}-private-a}"
PRIVATE_SUBNET_2_NAME="${PRIVATE_SUBNET_2_NAME:-${PROJECT_NAME}-private-b}"
IGW_NAME="${IGW_NAME:-${PROJECT_NAME}-igw}"
ROUTE_TABLE_NAME="${ROUTE_TABLE_NAME:-${PROJECT_NAME}-public-rt}"
NAT_EIP_NAME="${NAT_EIP_NAME:-${PROJECT_NAME}-nat-a-eip}"
NAT_2_EIP_NAME="${NAT_2_EIP_NAME:-${PROJECT_NAME}-nat-b-eip}"
NAT_GATEWAY_NAME="${NAT_GATEWAY_NAME:-${PROJECT_NAME}-nat-a}"
NAT_GATEWAY_2_NAME="${NAT_GATEWAY_2_NAME:-${PROJECT_NAME}-nat-b}"
PRIVATE_ROUTE_TABLE_NAME="${PRIVATE_ROUTE_TABLE_NAME:-${PROJECT_NAME}-private-a-rt}"
PRIVATE_ROUTE_TABLE_2_NAME="${PRIVATE_ROUTE_TABLE_2_NAME:-${PROJECT_NAME}-private-b-rt}"
VPC_FLOW_LOG_ROLE_NAME="${VPC_FLOW_LOG_ROLE_NAME:-${PROJECT_NAME}-vpc-flow-logs-role}"
VPC_FLOW_LOG_POLICY_NAME="${VPC_FLOW_LOG_POLICY_NAME:-${PROJECT_NAME}-vpc-flow-logs}"
VPC_FLOW_LOG_GROUP_NAME="${VPC_FLOW_LOG_GROUP_NAME:-/vpc/${PROJECT_NAME}/flow-logs}"
VPC_FLOW_LOG_NAME="${VPC_FLOW_LOG_NAME:-${PROJECT_NAME}-vpc-flow-log}"
VPC_FLOW_LOG_RETENTION_DAYS="${VPC_FLOW_LOG_RETENTION_DAYS:-90}"
SG_NAME="${SG_NAME:-${PROJECT_NAME}-ec2}"

ensure_vpc_flow_logs() {
  local vpc_id="$1"
  local role_policy flow_log_id log_group_arn

  aws_region logs create-log-group --log-group-name "$VPC_FLOW_LOG_GROUP_NAME" >/dev/null 2>&1 || true
  aws_region logs put-retention-policy \
    --log-group-name "$VPC_FLOW_LOG_GROUP_NAME" \
    --retention-in-days "$VPC_FLOW_LOG_RETENTION_DAYS" >/dev/null

  log_group_arn="arn:aws:logs:${AWS_REGION}:${ACCOUNT_ID}:log-group:${VPC_FLOW_LOG_GROUP_NAME}"
  role_policy=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"],
      "Resource": "${log_group_arn}:*"
    },
    {
      "Effect": "Allow",
      "Action": "logs:DescribeLogGroups",
      "Resource": "*"
    }
  ]
}
EOF
)

  VPC_FLOW_LOG_ROLE_ARN="$(ensure_role "$VPC_FLOW_LOG_ROLE_NAME" \
    '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"vpc-flow-logs.amazonaws.com"},"Action":"sts:AssumeRole"}]}')"
  aws iam put-role-policy \
    --role-name "$VPC_FLOW_LOG_ROLE_NAME" \
    --policy-name "$VPC_FLOW_LOG_POLICY_NAME" \
    --policy-document "$role_policy" >/dev/null

  flow_log_id=$(aws_region ec2 describe-flow-logs \
    --filter "Name=resource-id,Values=${vpc_id}" "Name=log-group-name,Values=${VPC_FLOW_LOG_GROUP_NAME}" \
    --query 'FlowLogs[0].FlowLogId' \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }')
  if [ -z "$flow_log_id" ]; then
    sleep 15
    flow_log_id=$(aws_region ec2 create-flow-logs \
      --resource-type VPC \
      --resource-ids "$vpc_id" \
      --traffic-type ALL \
      --log-destination-type cloud-watch-logs \
      --log-group-name "$VPC_FLOW_LOG_GROUP_NAME" \
      --deliver-logs-permission-arn "$VPC_FLOW_LOG_ROLE_ARN" \
      --tag-specifications "$(default_ec2_tag_spec vpc-flow-log "$VPC_FLOW_LOG_NAME")" \
      --query 'FlowLogIds[0]' \
      --output text)
  fi

  aws_region logs tag-resource \
    --resource-arn "$log_group_arn" \
    --tags "Name=${PROJECT_NAME}-flow-logs,Project=${PROJECT_NAME},Environment=${ENVIRONMENT}" >/dev/null 2>&1 || true
  VPC_FLOW_LOG_ID="$flow_log_id"
}

echo "Setting up networking for ${PROJECT_NAME} in ${AWS_REGION}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

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

AZ="us-east-1a"
AZ_2="us-east-1b"
SUBNET_ID="$(ensure_public_subnet "$VPC_ID" "$SUBNET_NAME" "$PUBLIC_SUBNET_CIDR" "$AZ")"
SUBNET_2_ID="$(ensure_public_subnet "$VPC_ID" "$SUBNET_2_NAME" "$PUBLIC_SUBNET_2_CIDR" "$AZ_2")"
PRIVATE_SUBNET_ID="$(ensure_private_subnet "$VPC_ID" "$PRIVATE_SUBNET_NAME" "$PRIVATE_SUBNET_CIDR" "$AZ")"
PRIVATE_SUBNET_2_ID="$(ensure_private_subnet "$VPC_ID" "$PRIVATE_SUBNET_2_NAME" "$PRIVATE_SUBNET_2_CIDR" "$AZ_2")"

IGW_ID="$(get_single_id_by_name ec2 describe-internet-gateways "$IGW_NAME" 'InternetGateways[0].InternetGatewayId')"
if [ -z "$IGW_ID" ]; then
  IGW_ID=$(aws_region ec2 create-internet-gateway \
    --tag-specifications "$(default_ec2_tag_spec internet-gateway "$IGW_NAME")" \
    --query 'InternetGateway.InternetGatewayId' \
    --output text)
fi
tag_ec2_resource "$IGW_ID" "$IGW_NAME"
aws_region ec2 attach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID" >/dev/null 2>&1 || true

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

NAT_EIP_ALLOC_ID="$(ensure_elastic_ip "$NAT_EIP_NAME")"
NAT_2_EIP_ALLOC_ID="$(ensure_elastic_ip "$NAT_2_EIP_NAME")"
NAT_GATEWAY_ID="$(ensure_nat_gateway "$NAT_GATEWAY_NAME" "$SUBNET_ID" "$NAT_EIP_ALLOC_ID")"
NAT_GATEWAY_2_ID="$(ensure_nat_gateway "$NAT_GATEWAY_2_NAME" "$SUBNET_2_ID" "$NAT_2_EIP_ALLOC_ID")"
PRIVATE_ROUTE_TABLE_ID="$(ensure_private_route_table "$VPC_ID" "$PRIVATE_ROUTE_TABLE_NAME" "$PRIVATE_SUBNET_ID" "$NAT_GATEWAY_ID")"
PRIVATE_ROUTE_TABLE_2_ID="$(ensure_private_route_table "$VPC_ID" "$PRIVATE_ROUTE_TABLE_2_NAME" "$PRIVATE_SUBNET_2_ID" "$NAT_GATEWAY_2_ID")"

SG_ID="$(ensure_security_group "$SG_NAME" "Dokumen EC2 web and SSH access" "$VPC_ID")"
authorize_tcp_from_cidr "$SG_ID" 22 "$ADMIN_CIDR"
authorize_tcp_from_cidr "$SG_ID" 80 0.0.0.0/0
authorize_tcp_from_cidr "$SG_ID" 443 0.0.0.0/0
authorize_tcp_from_cidr "$SG_ID" 81 "$ADMIN_CIDR"
default_sg_id="$(get_security_group_id default "$VPC_ID")"
if [ -n "$default_sg_id" ]; then
  revoke_default_security_group_ingress "$default_sg_id"
fi

ensure_vpc_flow_logs "$VPC_ID"

NETWORKING_ENV_FILE="${OUTPUT_DIR}/networking-resources.env"
NETWORKING_REPORT_FILE="${OUTPUT_DIR}/networking-report.txt"
write_env_output "$NETWORKING_ENV_FILE" \
  AWS_REGION PROJECT_NAME ENVIRONMENT ACCOUNT_ID ADMIN_CIDR \
  VPC_ID AZ AZ_2 SUBNET_ID SUBNET_2_ID PRIVATE_SUBNET_ID PRIVATE_SUBNET_2_ID \
  IGW_ID ROUTE_TABLE_ID NAT_EIP_ALLOC_ID NAT_2_EIP_ALLOC_ID NAT_GATEWAY_ID NAT_GATEWAY_2_ID \
  PRIVATE_ROUTE_TABLE_ID PRIVATE_ROUTE_TABLE_2_ID SG_ID VPC_FLOW_LOG_ID VPC_FLOW_LOG_ROLE_ARN

cat > "$NETWORKING_REPORT_FILE" <<EOF
Dokumen AWS networking resources
Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')

AWS_REGION=${AWS_REGION}
PROJECT_NAME=${PROJECT_NAME}
ACCOUNT_ID=${ACCOUNT_ID}
ADMIN_CIDR=${ADMIN_CIDR}

VPC_ID=${VPC_ID}
SUBNET_ID=${SUBNET_ID}
SUBNET_2_ID=${SUBNET_2_ID}
PRIVATE_SUBNET_ID=${PRIVATE_SUBNET_ID}
PRIVATE_SUBNET_2_ID=${PRIVATE_SUBNET_2_ID}
SG_ID=${SG_ID}
IGW_ID=${IGW_ID}
ROUTE_TABLE_ID=${ROUTE_TABLE_ID}
NAT_GATEWAY_ID=${NAT_GATEWAY_ID}
NAT_GATEWAY_2_ID=${NAT_GATEWAY_2_ID}
PRIVATE_ROUTE_TABLE_ID=${PRIVATE_ROUTE_TABLE_ID}
PRIVATE_ROUTE_TABLE_2_ID=${PRIVATE_ROUTE_TABLE_2_ID}
VPC_FLOW_LOG_ID=${VPC_FLOW_LOG_ID}
EOF

chmod 600 "$NETWORKING_REPORT_FILE" 2>/dev/null || true
echo "Networking complete."
echo "Resource output: $NETWORKING_ENV_FILE"
echo "Report: $NETWORKING_REPORT_FILE"
