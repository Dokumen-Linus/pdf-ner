#!/usr/bin/env bash

DEPLOY_AWS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${DEPLOY_AWS_DIR}/../.." && pwd)"
# shellcheck source=infra/shared/load-env-file.sh
# shellcheck disable=SC1091
. "${REPO_ROOT}/infra/shared/load-env-file.sh"
EXAMPLE_SECRETS_DIR="${EXAMPLE_SECRETS_DIR:-${REPO_ROOT}/infra/example-secrets}"
SECRET_DRAFT_DIR="${SECRET_DRAFT_DIR:-${DEPLOY_AWS_DIR}/local-secrets}"
OUTPUT_DIR="${OUTPUT_DIR:-${DEPLOY_AWS_DIR}/outputs}"

configure_common_defaults() {
  PROJECT_NAME="${PROJECT_NAME:-dokumen}"
  ENVIRONMENT="${ENVIRONMENT:-production}"
  AWS_REGION="${AWS_REGION:-us-east-1}"
  DOMAIN="${DOMAIN:-dokumenai.dev}"
  OUTPUT_DIR="${OUTPUT_DIR:-${DEPLOY_AWS_DIR}/outputs}"
  SECRET_DRAFT_DIR="${SECRET_DRAFT_DIR:-${DEPLOY_AWS_DIR}/secrets/local-secrets}"
}

aws_region() {
  aws --region "$AWS_REGION" "$@"
}

default_tag_pairs() {
  local name="$1"
  printf 'Key=Name,Value=%s Key=Project,Value=%s Key=Environment,Value=%s' "$name" "$PROJECT_NAME" "$ENVIRONMENT"
}

default_ec2_tag_spec() {
  local resource_type="$1"
  local name="$2"
  printf 'ResourceType=%s,Tags=[{Key=Name,Value=%s},{Key=Project,Value=%s},{Key=Environment,Value=%s}]' \
    "$resource_type" "$name" "$PROJECT_NAME" "$ENVIRONMENT"
}

tag_value_filter() {
  printf "Name=tag:Name,Values=%s" "$1"
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

uri_escape() {
  jq -rn --arg value "$1" '$value|@uri'
}

bool_flag() {
  local value="$1"
  if [ "$value" = "1" ] || [ "$value" = "true" ] || [ "$value" = "TRUE" ]; then
    printf 'true'
  else
    printf 'false'
  fi
}

get_single_id_by_name() {
  local service="$1"
  local describe_command="$2"
  local name="$3"
  local query="$4"
  aws_region "$service" "$describe_command" \
    --filters "$(tag_value_filter "$name")" \
    --query "$query" \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }'
}

get_availability_zone() {
  local index="$1"
  aws_region ec2 describe-availability-zones \
    --filters "Name=state,Values=available" \
    --query "AvailabilityZones[${index}].ZoneName" \
    --output text
}

tag_ec2_resource() {
  local resource_id="$1"
  local name="$2"
  local tag_args
  tag_args=("Key=Name,Value=${name}" "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=${ENVIRONMENT}")
  aws_region ec2 create-tags \
    --resources "$resource_id" \
    --tags "${tag_args[@]}" >/dev/null
}

tag_vpc_default_resources() {
  local vpc_id="$1"
  local prefix="$2"
  local default_sg_id main_route_table_id default_network_acl_id

  default_sg_id=$(aws_region ec2 describe-security-groups \
    --filters "Name=group-name,Values=default" "Name=vpc-id,Values=${vpc_id}" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }')
  if [ -n "$default_sg_id" ]; then
    tag_ec2_resource "$default_sg_id" "${prefix}-default-sg"
  fi

  main_route_table_id=$(aws_region ec2 describe-route-tables \
    --filters "Name=vpc-id,Values=${vpc_id}" "Name=association.main,Values=true" \
    --query 'RouteTables[0].RouteTableId' \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }')
  if [ -n "$main_route_table_id" ]; then
    tag_ec2_resource "$main_route_table_id" "${prefix}-main-rt"
  fi

  default_network_acl_id=$(aws_region ec2 describe-network-acls \
    --filters "Name=vpc-id,Values=${vpc_id}" "Name=default,Values=true" \
    --query 'NetworkAcls[0].NetworkAclId' \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }')
  if [ -n "$default_network_acl_id" ]; then
    tag_ec2_resource "$default_network_acl_id" "${prefix}-default-nacl"
  fi
}

get_security_group_id() {
  local group_name="$1"
  local vpc_id="$2"
  aws_region ec2 describe-security-groups \
    --filters "Name=group-name,Values=${group_name}" "Name=vpc-id,Values=${vpc_id}" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }'
}

ensure_security_group() {
  local group_name="$1"
  local description="$2"
  local vpc_id="$3"
  local group_id

  group_id="$(get_security_group_id "$group_name" "$vpc_id")"
  if [ -z "$group_id" ]; then
    group_id=$(aws_region ec2 create-security-group \
      --group-name "$group_name" \
      --description "$description" \
      --vpc-id "$vpc_id" \
      --query 'GroupId' \
      --output text)
  fi
  tag_ec2_resource "$group_id" "$group_name"
  printf '%s' "$group_id"
}

authorize_tcp_from_cidr() {
  local group_id="$1"
  local port="$2"
  local cidr="$3"
  aws_region ec2 authorize-security-group-ingress \
    --group-id "$group_id" \
    --protocol tcp \
    --port "$port" \
    --cidr "$cidr" >/dev/null 2>&1 || true
}

authorize_tcp_from_sg() {
  local group_id="$1"
  local port="$2"
  local source_group_id="$3"
  aws_region ec2 authorize-security-group-ingress \
    --group-id "$group_id" \
    --protocol tcp \
    --port "$port" \
    --source-group "$source_group_id" >/dev/null 2>&1 || true
}

revoke_default_security_group_ingress() {
  local group_id="$1"
  aws_region ec2 revoke-security-group-ingress \
    --group-id "$group_id" \
    --protocol -1 \
    --source-group "$group_id" >/dev/null 2>&1 || true
}

ensure_public_subnet() {
  local vpc_id="$1"
  local subnet_name="$2"
  local cidr="$3"
  local az="$4"
  local subnet_id

  subnet_id="$(get_single_id_by_name ec2 describe-subnets "$subnet_name" 'Subnets[0].SubnetId')"
  if [ -z "$subnet_id" ]; then
    subnet_id=$(aws_region ec2 create-subnet \
      --vpc-id "$vpc_id" \
      --cidr-block "$cidr" \
      --availability-zone "$az" \
      --tag-specifications "$(default_ec2_tag_spec subnet "$subnet_name")" \
      --query 'Subnet.SubnetId' \
      --output text)
  fi
  tag_ec2_resource "$subnet_id" "$subnet_name"
  aws_region ec2 modify-subnet-attribute --subnet-id "$subnet_id" --map-public-ip-on-launch
  printf '%s' "$subnet_id"
}

ensure_private_subnet() {
  local vpc_id="$1"
  local subnet_name="$2"
  local cidr="$3"
  local az="$4"
  local subnet_id

  subnet_id="$(get_single_id_by_name ec2 describe-subnets "$subnet_name" 'Subnets[0].SubnetId')"
  if [ -z "$subnet_id" ]; then
    subnet_id=$(aws_region ec2 create-subnet \
      --vpc-id "$vpc_id" \
      --cidr-block "$cidr" \
      --availability-zone "$az" \
      --tag-specifications "$(default_ec2_tag_spec subnet "$subnet_name")" \
      --query 'Subnet.SubnetId' \
      --output text)
  fi
  tag_ec2_resource "$subnet_id" "$subnet_name"
  aws_region ec2 modify-subnet-attribute --subnet-id "$subnet_id" --no-map-public-ip-on-launch
  printf '%s' "$subnet_id"
}

ensure_route_table_association() {
  local route_table_id="$1"
  local subnet_id="$2"
  aws_region ec2 associate-route-table \
    --route-table-id "$route_table_id" \
    --subnet-id "$subnet_id" >/dev/null 2>&1 || true
}

get_nat_gateway_id_by_name() {
  local name="$1"
  aws_region ec2 describe-nat-gateways \
    --filter "$(tag_value_filter "$name")" "Name=state,Values=pending,available" \
    --query 'NatGateways[0].NatGatewayId' \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }'
}

ensure_elastic_ip() {
  local eip_name="$1"
  local alloc_id

  alloc_id="$(aws_region ec2 describe-addresses \
    --filters "$(tag_value_filter "$eip_name")" \
    --query 'Addresses[0].AllocationId' \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }')"
  if [ -z "$alloc_id" ]; then
    alloc_id=$(aws_region ec2 allocate-address \
      --domain vpc \
      --tag-specifications "$(default_ec2_tag_spec elastic-ip "$eip_name")" \
      --query 'AllocationId' \
      --output text)
  fi
  tag_ec2_resource "$alloc_id" "$eip_name"
  printf '%s' "$alloc_id"
}

ensure_nat_gateway() {
  local nat_name="$1"
  local public_subnet_id="$2"
  local allocation_id="$3"
  local nat_gateway_id

  nat_gateway_id="$(get_nat_gateway_id_by_name "$nat_name")"
  if [ -z "$nat_gateway_id" ]; then
    nat_gateway_id=$(aws_region ec2 create-nat-gateway \
      --subnet-id "$public_subnet_id" \
      --allocation-id "$allocation_id" \
      --tag-specifications "$(default_ec2_tag_spec natgateway "$nat_name")" \
      --query 'NatGateway.NatGatewayId' \
      --output text)
  fi
  aws_region ec2 wait nat-gateway-available --nat-gateway-ids "$nat_gateway_id"
  printf '%s' "$nat_gateway_id"
}

ensure_private_route_table() {
  local vpc_id="$1"
  local route_table_name="$2"
  local private_subnet_id="$3"
  local nat_gateway_id="$4"
  local route_table_id

  route_table_id="$(get_single_id_by_name ec2 describe-route-tables "$route_table_name" 'RouteTables[0].RouteTableId')"
  if [ -z "$route_table_id" ]; then
    route_table_id=$(aws_region ec2 create-route-table \
      --vpc-id "$vpc_id" \
      --tag-specifications "$(default_ec2_tag_spec route-table "$route_table_name")" \
      --query 'RouteTable.RouteTableId' \
      --output text)
  fi
  tag_ec2_resource "$route_table_id" "$route_table_name"
  aws_region ec2 create-route \
    --route-table-id "$route_table_id" \
    --destination-cidr-block 0.0.0.0/0 \
    --nat-gateway-id "$nat_gateway_id" >/dev/null 2>&1 || true
  ensure_route_table_association "$route_table_id" "$private_subnet_id"
  printf '%s' "$route_table_id"
}

ensure_role() {
  local role_name="$1"
  local trust_policy="$2"
  local role_arn tag_args
  tag_args=("Key=Name,Value=${role_name}" "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=${ENVIRONMENT}")

  role_arn=$(aws iam get-role \
    --role-name "$role_name" \
    --query 'Role.Arn' \
    --output text 2>/dev/null || true)

  if [ -z "$role_arn" ]; then
    role_arn=$(aws iam create-role \
      --role-name "$role_name" \
      --assume-role-policy-document "$trust_policy" \
      --tags "${tag_args[@]}" \
      --query 'Role.Arn' \
      --output text)
  else
    aws iam update-assume-role-policy \
      --role-name "$role_name" \
      --policy-document "$trust_policy" >/dev/null
  fi

  aws iam tag-role \
    --role-name "$role_name" \
    --tags "${tag_args[@]}" >/dev/null
  printf '%s' "$role_arn"
}

ensure_policy() {
  local policy_name="$1"
  local policy_document="$2"
  local policy_arn version_count oldest_non_default_version tag_args
  tag_args=("Key=Name,Value=${policy_name}" "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=${ENVIRONMENT}")

  policy_arn=$(aws iam list-policies \
    --scope Local \
    --query "Policies[?PolicyName=='${policy_name}'].Arn | [0]" \
    --output text)

  if [ -z "$policy_arn" ] || [ "$policy_arn" = "None" ]; then
    policy_arn=$(aws iam create-policy \
      --policy-name "$policy_name" \
      --policy-document "$policy_document" \
      --tags "${tag_args[@]}" \
      --query 'Policy.Arn' \
      --output text)
  else
    version_count=$(aws iam list-policy-versions \
      --policy-arn "$policy_arn" \
      --query 'length(Versions)' \
      --output text)
    if [ "$version_count" -ge 5 ]; then
      oldest_non_default_version=$(aws iam list-policy-versions \
        --policy-arn "$policy_arn" \
        --query "sort_by(Versions[?IsDefaultVersion==\`false\`], &CreateDate)[0].VersionId" \
        --output text)
      if [ -n "$oldest_non_default_version" ] && [ "$oldest_non_default_version" != "None" ]; then
        aws iam delete-policy-version \
          --policy-arn "$policy_arn" \
          --version-id "$oldest_non_default_version"
      fi
    fi
    aws iam create-policy-version \
      --policy-arn "$policy_arn" \
      --policy-document "$policy_document" \
      --set-as-default >/dev/null
  fi

  aws iam tag-policy \
    --policy-arn "$policy_arn" \
    --tags "${tag_args[@]}" >/dev/null
  printf '%s' "$policy_arn"
}

ensure_oidc_provider() {
  local provider_host provider_arn tag_args
  provider_host="${GITHUB_OIDC_PROVIDER_URL#https://}"
  provider_host="${provider_host#http://}"
  provider_host="${provider_host%%/*}"
  tag_args=("Key=Name,Value=${GITHUB_OIDC_PROVIDER_NAME}" "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=${ENVIRONMENT}")

  provider_arn=$(aws iam list-open-id-connect-providers \
    --query "OpenIDConnectProviderList[?contains(Arn, '${provider_host}')].Arn | [0]" \
    --output text)

  if [ -z "$provider_arn" ] || [ "$provider_arn" = "None" ]; then
    provider_arn=$(aws iam create-open-id-connect-provider \
      --url "$GITHUB_OIDC_PROVIDER_URL" \
      --client-id-list sts.amazonaws.com \
      --tags "${tag_args[@]}" \
      --query 'OpenIDConnectProviderArn' \
      --output text)
  else
    aws iam add-client-id-to-open-id-connect-provider \
      --open-id-connect-provider-arn "$provider_arn" \
      --client-id sts.amazonaws.com >/dev/null 2>&1 || true
  fi

  aws iam tag-open-id-connect-provider \
    --open-id-connect-provider-arn "$provider_arn" \
    --tags "${tag_args[@]}" >/dev/null
  printf '%s' "$provider_arn"
}

ensure_instance_profile() {
  local role_name="$1"
  local profile_name="$2"
  local tag_args
  tag_args=("Key=Name,Value=${profile_name}" "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=${ENVIRONMENT}")

  aws iam get-instance-profile --instance-profile-name "$profile_name" >/dev/null 2>&1 \
    || aws iam create-instance-profile \
      --instance-profile-name "$profile_name" \
      --tags "${tag_args[@]}" >/dev/null

  aws iam tag-instance-profile \
    --instance-profile-name "$profile_name" \
    --tags "${tag_args[@]}" >/dev/null

  if ! aws iam get-instance-profile \
    --instance-profile-name "$profile_name" \
    --query "InstanceProfile.Roles[?RoleName=='${role_name}'].RoleName | [0]" \
    --output text | grep -qx "$role_name"; then
    aws iam add-role-to-instance-profile \
      --instance-profile-name "$profile_name" \
      --role-name "$role_name" >/dev/null
  fi
}

ensure_instance_profile_attached() {
  local instance_id="$1"
  local profile_name="$2"
  local association_id current_profile

  association_id=$(aws_region ec2 describe-iam-instance-profile-associations \
    --filters "Name=instance-id,Values=${instance_id}" "Name=state,Values=associated" \
    --query 'IamInstanceProfileAssociations[0].AssociationId' \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }')
  current_profile=$(aws_region ec2 describe-iam-instance-profile-associations \
    --filters "Name=instance-id,Values=${instance_id}" "Name=state,Values=associated" \
    --query 'IamInstanceProfileAssociations[0].IamInstanceProfile.Arn' \
    --output text 2>/dev/null | awk -F/ 'NF && $NF != "None" { print $NF; exit }')

  if [ -z "$association_id" ]; then
    aws_region ec2 associate-iam-instance-profile \
      --instance-id "$instance_id" \
      --iam-instance-profile "Name=${profile_name}" >/dev/null
  elif [ "$current_profile" != "$profile_name" ]; then
    aws_region ec2 replace-iam-instance-profile-association \
      --association-id "$association_id" \
      --iam-instance-profile "Name=${profile_name}" >/dev/null
  fi
}

ensure_db_subnet_group() {
  local subnet_group_name="$1"
  local description="$2"
  local subnet_group_arn tag_args
  shift 2
  tag_args=("Key=Name,Value=${subnet_group_name}" "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=${ENVIRONMENT}")

  if aws_region rds describe-db-subnet-groups \
    --db-subnet-group-name "$subnet_group_name" >/dev/null 2>&1; then
    aws_region rds modify-db-subnet-group \
      --db-subnet-group-name "$subnet_group_name" \
      --subnet-ids "$@" >/dev/null
  else
    aws_region rds create-db-subnet-group \
      --db-subnet-group-name "$subnet_group_name" \
      --db-subnet-group-description "$description" \
      --subnet-ids "$@" >/dev/null
  fi

  subnet_group_arn=$(aws_region rds describe-db-subnet-groups \
    --db-subnet-group-name "$subnet_group_name" \
    --query 'DBSubnetGroups[0].DBSubnetGroupArn' \
    --output text)
  aws_region rds add-tags-to-resource \
    --resource-name "$subnet_group_arn" \
    --tags "${tag_args[@]}" >/dev/null
}

ensure_postgres_rds_instance() {
  local db_identifier="$1"
  local subnet_group_name="$2"
  local security_group_id="$3"
  local master_password="$4"
  local publicly_accessible="$5"
  local deletion_protection="$6"
  local multi_az="$7"
  local public_flag deletion_flag multi_az_flag db_instance_arn tag_args
  tag_args=("Key=Name,Value=${db_identifier}" "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=${ENVIRONMENT}")

  if [ "$publicly_accessible" = "true" ]; then
    public_flag="--publicly-accessible"
  else
    public_flag="--no-publicly-accessible"
  fi

  if [ "$deletion_protection" = "true" ]; then
    deletion_flag="--deletion-protection"
  else
    deletion_flag="--no-deletion-protection"
  fi

  if [ "$multi_az" = "true" ]; then
    multi_az_flag="--multi-az"
  else
    multi_az_flag="--no-multi-az"
  fi

  if aws_region rds describe-db-instances \
    --db-instance-identifier "$db_identifier" >/dev/null 2>&1; then
    echo "Reusing RDS instance: $db_identifier"
    aws_region rds modify-db-instance \
      --db-instance-identifier "$db_identifier" \
      --vpc-security-group-ids "$security_group_id" \
      --backup-retention-period "$RDS_BACKUP_RETENTION_DAYS" \
      --no-enable-iam-database-authentication \
      "$public_flag" \
      "$deletion_flag" \
      "$multi_az_flag" \
      --apply-immediately >/dev/null
  else
    aws_region rds create-db-instance \
      --db-instance-identifier "$db_identifier" \
      --engine "$RDS_ENGINE" \
      --engine-version "$RDS_ENGINE_VERSION" \
      --db-instance-class "$RDS_INSTANCE_CLASS" \
      --allocated-storage "$RDS_ALLOCATED_STORAGE" \
      --storage-type "$RDS_STORAGE_TYPE" \
      --master-username "$RDS_MASTER_USERNAME" \
      --master-user-password "$master_password" \
      --db-subnet-group-name "$subnet_group_name" \
      --vpc-security-group-ids "$security_group_id" \
      --backup-retention-period "$RDS_BACKUP_RETENTION_DAYS" \
      --storage-encrypted \
      --no-enable-iam-database-authentication \
      "$public_flag" \
      "$deletion_flag" \
      "$multi_az_flag" \
      --copy-tags-to-snapshot \
      --tags "${tag_args[@]}" >/dev/null
    echo "Created RDS instance: $db_identifier"
  fi

  aws_region rds wait db-instance-available --db-instance-identifier "$db_identifier"
  db_instance_arn=$(aws_region rds describe-db-instances \
    --db-instance-identifier "$db_identifier" \
    --query 'DBInstances[0].DBInstanceArn' \
    --output text)
  aws_region rds add-tags-to-resource \
    --resource-name "$db_instance_arn" \
    --tags "${tag_args[@]}" >/dev/null
}

get_rds_endpoint() {
  local db_identifier="$1"
  aws_region rds describe-db-instances \
    --db-instance-identifier "$db_identifier" \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }'
}

postgres_url() {
  local username="$1"
  local password="$2"
  local host="$3"
  local db_name="$4"
  printf 'postgres://%s:%s@%s:%s/%s?sslmode=require' \
    "$(uri_escape "$username")" "$(uri_escape "$password")" "$host" "$RDS_PORT" "$(uri_escape "$db_name")"
}

draft_path() {
  printf '%s/%s' "$SECRET_DRAFT_DIR" "$1"
}

ensure_secret_drafts() {
  local name source target
  mkdir -p "$SECRET_DRAFT_DIR"
  for name in prod-web.json prod-email.json prod-api.json prod-workers.json prod-runpod.json; do
    source="${EXAMPLE_SECRETS_DIR}/${name}"
    target="$(draft_path "$name")"
    if [ ! -f "$target" ]; then
      cp "$source" "$target"
      chmod 600 "$target" 2>/dev/null || true
    fi
  done
}

set_secret_draft_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  local target tmp
  target="$(draft_path "$file")"
  tmp="${target}.tmp"
  jq --arg key "$key" --arg value "$value" '.[$key] = $value' "$target" > "$tmp"
  mv "$tmp" "$target"
}

ensure_output_dir() {
  mkdir -p "$OUTPUT_DIR"
}

write_env_output() {
  local output_file="$1"
  local name
  shift
  ensure_output_dir
  {
    echo "# Generated by infra/deploy-aws."
    echo "# Resource output only; scripts discover resources by name and do not read this as input."
    for name in "$@"; do
      if [ "${!name+x}" = "x" ]; then
        printf '%s=%q\n' "$name" "${!name}"
      fi
    done
  } > "$output_file"
  chmod 600 "$output_file" 2>/dev/null || true
}

remote_run() {
  local elastic_ip="$1"
  shift
  ssh \
    -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout="$SSH_CONNECT_TIMEOUT" \
    -o ServerAliveInterval="$SSH_SERVER_ALIVE_INTERVAL" \
    -o ServerAliveCountMax="$SSH_SERVER_ALIVE_COUNT_MAX" \
    -i "$SSH_PRIVATE_KEY_PATH" \
    "ec2-user@${elastic_ip}" "$@"
}

remote_probe() {
  local elastic_ip="$1"
  ssh \
    -o BatchMode=yes \
    -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout="$SSH_CONNECT_TIMEOUT" \
    -o ServerAliveInterval="$SSH_SERVER_ALIVE_INTERVAL" \
    -o ServerAliveCountMax="$SSH_SERVER_ALIVE_COUNT_MAX" \
    -i "$SSH_PRIVATE_KEY_PATH" \
    "ec2-user@${elastic_ip}" true
}
