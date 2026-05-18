#!/usr/bin/env bash
# shellcheck disable=SC2034

INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
PROD_ENV_FILE="${PROD_ENV_FILE:-${INFRA_DIR}/.env.prod}"
EXAMPLE_SECRETS_DIR="${EXAMPLE_SECRETS_DIR:-${INFRA_DIR}/example-secrets}"
SECRET_DRAFT_DIR="${SECRET_DRAFT_DIR:-${SCRIPT_DIR}/local-secrets}"
SETUP_STATE_DIR="${SETUP_STATE_DIR:-${SCRIPT_DIR}/local-state}"
SETUP_STATE_FILE="${SETUP_STATE_FILE:-${SETUP_STATE_DIR}/aws-setup.state}"
SETUP_REPORT_FILE="${SETUP_REPORT_FILE:-${SETUP_STATE_DIR}/aws-setup.report.txt}"

SETUP_STATE_VARS=(
  SETUP_COMPLETED_STEPS
  SETUP_LAST_STARTED_STEP
  SETUP_LAST_SUCCESSFUL_STEP
  SETUP_LAST_FAILED_STEP
  SETUP_LAST_STATUS
  SETUP_LAST_UPDATED_AT
  CURRENT_SETUP_STEP
  ACCOUNT_ID
  MY_IP
  AVATARS_S3_BUCKET_NAME
  VPC_ID
  AZ
  AZ_2
  SUBNET_ID
  SUBNET_2_ID
  PRIVATE_SUBNET_ID
  PRIVATE_SUBNET_2_ID
  IGW_ID
  ROUTE_TABLE_ID
  NAT_EIP_ALLOC_ID
  NAT_2_EIP_ALLOC_ID
  NAT_GATEWAY_ID
  NAT_GATEWAY_2_ID
  PRIVATE_ROUTE_TABLE_ID
  PRIVATE_ROUTE_TABLE_2_ID
  VPC_FLOW_LOG_ID
  VPC_FLOW_LOG_ROLE_ARN
  SG_ID
  AMI_ID
  INSTANCE_ID
  ALLOC_ID
  ELASTIC_IP
  EC2_ROLE_ARN
  EC2_RUNTIME_POLICY_ARN
  GITHUB_OIDC_PROVIDER_ARN
  GITHUB_DEPLOY_ROLE_ARN
  GITHUB_DEPLOY_POLICY_ARN
  RDS_SG_ID
  PROD_RDS_HOST
  DEV_VPC_ID
  DEV_AZ
  DEV_AZ_2
  DEV_SUBNET_1_ID
  DEV_SUBNET_2_ID
  DEV_IGW_ID
  DEV_ROUTE_TABLE_ID
  DEV_RDS_SG_ID
  DEV_RDS_HOST
)

LOCAL_ENV_PRESERVED_OVERRIDES=(
  DO_DEPLOY
  UPLOAD_LOCAL_ENV
  START_COMPOSE
  SETUP_RESUME
  SETUP_START_AT
  SETUP_STOP_AFTER
  SETUP_ONLY
  CREATE_PROD_RDS
  CREATE_DEV_RDS
  REFRESH_RDS_ADMIN_IP
  PROD_RDS_ALLOW_LOCAL_ADMIN
  PROD_RDS_MULTI_AZ
  PROD_RDS_MASTER_PASSWORD
  DEV_RDS_MASTER_PASSWORD
  AUTH_ROLE_PASSWORD
  WEB_USER_PASSWORD
  API_USER_PASSWORD
  WORKERS_USER_PASSWORD
)

declare -A LOCAL_ENV_OVERRIDE_VALUES=()

capture_local_env_overrides() {
  local name
  LOCAL_ENV_OVERRIDE_VALUES=()

  for name in "${LOCAL_ENV_PRESERVED_OVERRIDES[@]}"; do
    if [ "${!name+x}" = "x" ]; then
      LOCAL_ENV_OVERRIDE_VALUES["$name"]="${!name}"
    fi
  done
}

restore_local_env_overrides() {
  local name

  for name in "${!LOCAL_ENV_OVERRIDE_VALUES[@]}"; do
    printf -v "$name" '%s' "${LOCAL_ENV_OVERRIDE_VALUES[$name]}"
    export "$name"
  done
}

load_local_env() {
  if [ -f "$LOCAL_ENV_FILE" ]; then
    capture_local_env_overrides
    set -a
    # shellcheck disable=SC1090
    . "$LOCAL_ENV_FILE"
    set +a
    restore_local_env_overrides
  fi
}

configure_defaults() {
  PROJECT_NAME="${PROJECT_NAME:-dokumen}"
  ENVIRONMENT="${ENVIRONMENT:-production}"
  AWS_REGION="${AWS_REGION:-us-east-1}"
  INSTANCE_TYPE="${INSTANCE_TYPE:-t3.medium}"
  EC2_ROOT_VOLUME_SIZE="${EC2_ROOT_VOLUME_SIZE:-40}"
  EC2_DETAILED_MONITORING="${EC2_DETAILED_MONITORING:-1}"
  EC2_TERMINATION_PROTECTION="${EC2_TERMINATION_PROTECTION:-1}"
  EC2_SSH_ENABLED="${EC2_SSH_ENABLED:-1}"
  DOMAIN="${DOMAIN:-dokumenai.dev}"
  REPO_URL="${REPO_URL:-https://github.com/optimalcharb/pdf-ner.git}"
  DEPLOY_BRANCH="${DEPLOY_BRANCH:-}"
  GITHUB_REPO="${GITHUB_REPO:-}"
  GITHUB_DEPLOY_KEY_PATH="${GITHUB_DEPLOY_KEY_PATH:-}"

  KEY_NAME="${KEY_NAME:-${PROJECT_NAME}-ec2}"
  SSH_PUBKEY_PATH="${SSH_PUBKEY_PATH:-$HOME/.ssh/${PROJECT_NAME}-ec2.pub}"
  SSH_PRIVATE_KEY_PATH="${SSH_PRIVATE_KEY_PATH:-$HOME/.ssh/${PROJECT_NAME}-ec2}"
  REMOTE_APP_DIR="${REMOTE_APP_DIR:-/opt/${PROJECT_NAME}/pdf-ner}"
  DO_DEPLOY="${DO_DEPLOY:-1}"
  UPLOAD_LOCAL_ENV="${UPLOAD_LOCAL_ENV:-1}"
  START_COMPOSE="${START_COMPOSE:-1}"
  SETUP_RESUME="${SETUP_RESUME:-0}"
  SETUP_START_AT="${SETUP_START_AT:-}"
  SETUP_STOP_AFTER="${SETUP_STOP_AFTER:-}"
  SETUP_ONLY="${SETUP_ONLY:-}"
  SSH_CONNECT_TIMEOUT="${SSH_CONNECT_TIMEOUT:-10}"
  SSH_WAIT_ATTEMPTS="${SSH_WAIT_ATTEMPTS:-30}"
  SSH_WAIT_SECONDS="${SSH_WAIT_SECONDS:-30}"

  SES_IDENTITY_EMAIL="${SES_IDENTITY_EMAIL:-no-reply@${DOMAIN}}"

  VPC_CIDR="${VPC_CIDR:-10.40.0.0/16}"
  PUBLIC_SUBNET_CIDR="${PUBLIC_SUBNET_CIDR:-10.40.1.0/24}"
  PUBLIC_SUBNET_2_CIDR="${PUBLIC_SUBNET_2_CIDR:-10.40.2.0/24}"
  PRIVATE_SUBNET_CIDR="${PRIVATE_SUBNET_CIDR:-10.40.101.0/24}"
  PRIVATE_SUBNET_2_CIDR="${PRIVATE_SUBNET_2_CIDR:-10.40.102.0/24}"

  VPC_NAME="${PROJECT_NAME}-vpc"
  SUBNET_NAME="${PROJECT_NAME}-public-subnet"
  SUBNET_2_NAME="${PROJECT_NAME}-public-subnet-2"
  PRIVATE_SUBNET_NAME="${PROJECT_NAME}-private-subnet"
  PRIVATE_SUBNET_2_NAME="${PROJECT_NAME}-private-subnet-2"
  IGW_NAME="${PROJECT_NAME}-igw"
  ROUTE_TABLE_NAME="${PROJECT_NAME}-public-rt"
  NAT_EIP_NAME="${PROJECT_NAME}-nat-eip"
  NAT_2_EIP_NAME="${PROJECT_NAME}-nat-eip-2"
  NAT_GATEWAY_NAME="${PROJECT_NAME}-nat"
  NAT_GATEWAY_2_NAME="${PROJECT_NAME}-nat-2"
  PRIVATE_ROUTE_TABLE_NAME="${PROJECT_NAME}-private-rt"
  PRIVATE_ROUTE_TABLE_2_NAME="${PROJECT_NAME}-private-rt-2"
  VPC_FLOW_LOG_ROLE_NAME="${PROJECT_NAME}-vpc-flow-logs-role"
  VPC_FLOW_LOG_POLICY_NAME="${PROJECT_NAME}-vpc-flow-logs"
  VPC_FLOW_LOG_GROUP_NAME="${VPC_FLOW_LOG_GROUP_NAME:-/vpc/${PROJECT_NAME}/flow-logs}"
  VPC_FLOW_LOG_RETENTION_DAYS="${VPC_FLOW_LOG_RETENTION_DAYS:-90}"
  SG_NAME="${PROJECT_NAME}-ec2-sg"
  INSTANCE_NAME="${PROJECT_NAME}-ec2"
  EIP_NAME="${PROJECT_NAME}-eip"

  PROD_RDS_IDENTIFIER="${PROD_RDS_IDENTIFIER:-dokuprod}"
  PROD_RDS_SUBNET_GROUP_NAME="${PROD_RDS_SUBNET_GROUP_NAME:-${PROJECT_NAME}-prod-rds-subnets}"
  PROD_RDS_SG_NAME="${PROD_RDS_SG_NAME:-${PROJECT_NAME}-prod-rds-sg}"
  PROD_RDS_ALLOW_LOCAL_ADMIN="${PROD_RDS_ALLOW_LOCAL_ADMIN:-1}"
  PROD_RDS_MULTI_AZ="${PROD_RDS_MULTI_AZ:-1}"
  CREATE_PROD_RDS="${CREATE_PROD_RDS:-1}"

  DEV_PROJECT_NAME="${DEV_PROJECT_NAME:-${PROJECT_NAME}-dev}"
  DEV_VPC_CIDR="${DEV_VPC_CIDR:-10.50.0.0/16}"
  DEV_PUBLIC_SUBNET_1_CIDR="${DEV_PUBLIC_SUBNET_1_CIDR:-10.50.1.0/24}"
  DEV_PUBLIC_SUBNET_2_CIDR="${DEV_PUBLIC_SUBNET_2_CIDR:-10.50.2.0/24}"
  DEV_VPC_NAME="${DEV_VPC_NAME:-${DEV_PROJECT_NAME}-vpc}"
  DEV_SUBNET_1_NAME="${DEV_SUBNET_1_NAME:-${DEV_PROJECT_NAME}-public-subnet-1}"
  DEV_SUBNET_2_NAME="${DEV_SUBNET_2_NAME:-${DEV_PROJECT_NAME}-public-subnet-2}"
  DEV_IGW_NAME="${DEV_IGW_NAME:-${DEV_PROJECT_NAME}-igw}"
  DEV_ROUTE_TABLE_NAME="${DEV_ROUTE_TABLE_NAME:-${DEV_PROJECT_NAME}-public-rt}"
  DEV_RDS_IDENTIFIER="${DEV_RDS_IDENTIFIER:-dokudev}"
  DEV_RDS_SUBNET_GROUP_NAME="${DEV_RDS_SUBNET_GROUP_NAME:-${DEV_PROJECT_NAME}-rds-subnets}"
  DEV_RDS_SG_NAME="${DEV_RDS_SG_NAME:-${DEV_PROJECT_NAME}-rds-sg}"
  CREATE_DEV_RDS="${CREATE_DEV_RDS:-1}"
  REFRESH_RDS_ADMIN_IP="${REFRESH_RDS_ADMIN_IP:-1}"

  RDS_ENGINE="${RDS_ENGINE:-postgres}"
  RDS_ENGINE_VERSION="${RDS_ENGINE_VERSION:-18.4}"
  RDS_INSTANCE_CLASS="${RDS_INSTANCE_CLASS:-db.t4g.micro}"
  RDS_ALLOCATED_STORAGE="${RDS_ALLOCATED_STORAGE:-20}"
  RDS_STORAGE_TYPE="${RDS_STORAGE_TYPE:-gp3}"
  RDS_DB_NAME="${RDS_DB_NAME:-dokumen}"
  RDS_MASTER_USERNAME="${RDS_MASTER_USERNAME:-postgres}"
  RDS_BACKUP_RETENTION_DAYS="${RDS_BACKUP_RETENTION_DAYS:-7}"
  RDS_DELETION_PROTECTION="${RDS_DELETION_PROTECTION:-1}"
  RDS_SKIP_FINAL_SNAPSHOT="${RDS_SKIP_FINAL_SNAPSHOT:-0}"
  RDS_PORT="${RDS_PORT:-5432}"

  WEB_ECR_REPOSITORY="${WEB_ECR_REPOSITORY:-${PROJECT_NAME}-web}"
  API_ECR_REPOSITORY="${API_ECR_REPOSITORY:-${PROJECT_NAME}-api}"
  WORKERS_ECR_REPOSITORY="${WORKERS_ECR_REPOSITORY:-${PROJECT_NAME}-workers}"
  GPU_DEEPSEEK_ECR_REPOSITORY="${GPU_DEEPSEEK_ECR_REPOSITORY:-${PROJECT_NAME}-deepseek-ocr}"
  GPU_OLM_OCR2_ECR_REPOSITORY="${GPU_OLM_OCR2_ECR_REPOSITORY:-${PROJECT_NAME}-olm-ocr2}"
  ECR_UNTAGGED_IMAGE_RETENTION_DAYS="${ECR_UNTAGGED_IMAGE_RETENTION_DAYS:-14}"
  EC2_ROLE_NAME="${PROJECT_NAME}-ec2-runtime-role"
  EC2_INSTANCE_PROFILE_NAME="${PROJECT_NAME}-ec2-instance-profile"
  EC2_RUNTIME_POLICY_NAME="${PROJECT_NAME}-ec2-runtime"
  GITHUB_DEPLOY_ROLE_NAME="${PROJECT_NAME}-github-deploy"
  GITHUB_DEPLOY_POLICY_NAME="${PROJECT_NAME}-github-deploy"
  GITHUB_OIDC_PROVIDER_NAME="${PROJECT_NAME}-github-oidc-provider"
  GITHUB_OIDC_PROVIDER_URL="https://token.actions.githubusercontent.com"

  SETUP_COMPLETED_STEPS="${SETUP_COMPLETED_STEPS:-}"
  SETUP_LAST_STARTED_STEP="${SETUP_LAST_STARTED_STEP:-}"
  SETUP_LAST_SUCCESSFUL_STEP="${SETUP_LAST_SUCCESSFUL_STEP:-}"
  SETUP_LAST_FAILED_STEP="${SETUP_LAST_FAILED_STEP:-}"
  SETUP_LAST_STATUS="${SETUP_LAST_STATUS:-new}"
  SETUP_LAST_UPDATED_AT="${SETUP_LAST_UPDATED_AT:-}"
  CURRENT_SETUP_STEP="${CURRENT_SETUP_STEP:-}"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1" >&2
    return 1
  fi
}

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "ERROR: required environment variable is not set: $name" >&2
    echo "Set it in $LOCAL_ENV_FILE or export it before running this script." >&2
    return 1
  fi
}

require_non_placeholder_env() {
  local name="$1"
  require_env "$name"
  case "${!name}" in
    REPLACE_ME*|*REPLACE_ME*)
      echo "ERROR: environment variable still contains a placeholder: $name" >&2
      echo "Set a real value in $LOCAL_ENV_FILE or export it before running this script." >&2
      return 1
      ;;
  esac
}

validate_rds_master_password() {
  local name="$1"
  local value="${!name:-}"

  require_non_placeholder_env "$name"

  if [ "${#value}" -lt 8 ] || [ "${#value}" -gt 128 ]; then
    echo "ERROR: $name must be 8 to 128 characters for RDS PostgreSQL." >&2
    return 1
  fi

  case "$value" in
    *['/@" ']*)
      echo "ERROR: $name contains an invalid RDS master password character." >&2
      echo "Use printable ASCII, excluding slash (/), at sign (@), double quote, and spaces." >&2
      return 1
      ;;
  esac
}

utc_now() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

setup_step_completed() {
  local step_id="$1"
  case " ${SETUP_COMPLETED_STEPS:-} " in
    *" ${step_id} "*) return 0 ;;
    *) return 1 ;;
  esac
}

mark_setup_step_completed() {
  local step_id="$1"
  if ! setup_step_completed "$step_id"; then
    SETUP_COMPLETED_STEPS="${SETUP_COMPLETED_STEPS:+$SETUP_COMPLETED_STEPS }$step_id"
  fi
}

write_setup_report() {
  local tmp
  mkdir -p "$SETUP_STATE_DIR"
  tmp="${SETUP_REPORT_FILE}.tmp"
  cat > "$tmp" <<EOF
Dokumen AWS setup state
Updated: ${SETUP_LAST_UPDATED_AT:-unknown}
Status: ${SETUP_LAST_STATUS:-unknown}
Current step: ${CURRENT_SETUP_STEP:-none}
Last started step: ${SETUP_LAST_STARTED_STEP:-none}
Last successful step: ${SETUP_LAST_SUCCESSFUL_STEP:-none}
Last failed step: ${SETUP_LAST_FAILED_STEP:-none}
Completed steps: ${SETUP_COMPLETED_STEPS:-none}

Resume commands:
  SETUP_RESUME=1 bash infra/init/aws-setup.sh
  SETUP_START_AT=<step-id> bash infra/init/aws-setup.sh
  SETUP_ONLY=<step-id> bash infra/init/aws-setup.sh

State files:
  SETUP_STATE_FILE=${SETUP_STATE_FILE}
  SETUP_REPORT_FILE=${SETUP_REPORT_FILE}
  SECRET_DRAFT_DIR=${SECRET_DRAFT_DIR}

Step ids:
  prerequisites
  networking
  ec2-instance
  avatar-bucket
  ecr-runtime-iam
  github-deploy-iam
  prod-rds
  dev-rds
  rds-admin-ingress
  secrets-ses
  ec2-deployment
  summary

  AWS/resource context:
  AWS_REGION=${AWS_REGION:-unknown}
  PROJECT_NAME=${PROJECT_NAME:-unknown}
  ENVIRONMENT=${ENVIRONMENT:-unknown}
  DOMAIN=${DOMAIN:-unknown}
  GITHUB_REPO=${GITHUB_REPO:-unknown}
  DEPLOY_BRANCH=${DEPLOY_BRANCH:-unknown}
  ACCOUNT_ID=${ACCOUNT_ID:-unknown}
  MY_IP=${MY_IP:-unknown}
  AVATARS_S3_BUCKET_NAME=${AVATARS_S3_BUCKET_NAME:-unknown}

Network:
  VPC_ID=${VPC_ID:-unknown}
  SUBNET_ID=${SUBNET_ID:-unknown}
  SUBNET_2_ID=${SUBNET_2_ID:-unknown}
  PRIVATE_SUBNET_ID=${PRIVATE_SUBNET_ID:-unknown}
  PRIVATE_SUBNET_2_ID=${PRIVATE_SUBNET_2_ID:-unknown}
  SG_ID=${SG_ID:-unknown}
  IGW_ID=${IGW_ID:-unknown}
  ROUTE_TABLE_ID=${ROUTE_TABLE_ID:-unknown}
  NAT_GATEWAY_ID=${NAT_GATEWAY_ID:-unknown}
  NAT_GATEWAY_2_ID=${NAT_GATEWAY_2_ID:-unknown}
  PRIVATE_ROUTE_TABLE_ID=${PRIVATE_ROUTE_TABLE_ID:-unknown}
  PRIVATE_ROUTE_TABLE_2_ID=${PRIVATE_ROUTE_TABLE_2_ID:-unknown}
  VPC_FLOW_LOG_ID=${VPC_FLOW_LOG_ID:-unknown}

EC2:
  INSTANCE_ID=${INSTANCE_ID:-unknown}
  ELASTIC_IP=${ELASTIC_IP:-unknown}
  ALLOC_ID=${ALLOC_ID:-unknown}

IAM:
  EC2_ROLE_ARN=${EC2_ROLE_ARN:-unknown}
  EC2_RUNTIME_POLICY_ARN=${EC2_RUNTIME_POLICY_ARN:-unknown}
  GITHUB_OIDC_PROVIDER_ARN=${GITHUB_OIDC_PROVIDER_ARN:-unknown}
  GITHUB_DEPLOY_ROLE_ARN=${GITHUB_DEPLOY_ROLE_ARN:-unknown}
  GITHUB_DEPLOY_POLICY_ARN=${GITHUB_DEPLOY_POLICY_ARN:-unknown}

RDS:
  RDS_SG_ID=${RDS_SG_ID:-unknown}
  PROD_RDS_HOST=${PROD_RDS_HOST:-unknown}
  DEV_VPC_ID=${DEV_VPC_ID:-unknown}
  DEV_RDS_SG_ID=${DEV_RDS_SG_ID:-unknown}
  DEV_RDS_HOST=${DEV_RDS_HOST:-unknown}
EOF
  mv "$tmp" "$SETUP_REPORT_FILE"
}

save_setup_state() {
  local status="${1:-saved}"
  local tmp name
  mkdir -p "$SETUP_STATE_DIR"
  chmod 700 "$SETUP_STATE_DIR" 2>/dev/null || true
  tmp="${SETUP_STATE_FILE}.tmp"
  SETUP_LAST_STATUS="$status"
  SETUP_LAST_UPDATED_AT="$(utc_now)"

  {
    echo "# Generated by infra/init/aws-setup.sh."
    echo "# Contains non-secret setup state for resumable runs."
    echo "# Do not put passwords or app secrets in this file."
    for name in "${SETUP_STATE_VARS[@]}"; do
      if [ "${!name+x}" = "x" ]; then
        printf '%s=%q\n' "$name" "${!name}"
      fi
    done
  } > "$tmp"
  chmod 600 "$tmp" 2>/dev/null || true
  mv "$tmp" "$SETUP_STATE_FILE"
  write_setup_report
}

load_setup_state() {
  if [ -f "$SETUP_STATE_FILE" ]; then
    # shellcheck disable=SC1090
    . "$SETUP_STATE_FILE"
    echo "Loaded setup state: $SETUP_STATE_FILE"
    echo "State report:       $SETUP_REPORT_FILE"
    echo ""
  fi
}

require_setup_values() {
  local label="$1"
  local name missing
  missing=0
  shift

  for name in "$@"; do
    if [ -z "${!name:-}" ]; then
      echo "ERROR: $label requires missing setup state: $name" >&2
      missing=1
    fi
  done

  if [ "$missing" = "1" ]; then
    echo "Run the earlier setup step first, or load a valid state file with SETUP_STATE_FILE." >&2
    echo "Current state file: $SETUP_STATE_FILE" >&2
    return 1
  fi
}

handle_setup_error() {
  local exit_code="$?"
  trap - ERR
  SETUP_LAST_FAILED_STEP="${CURRENT_SETUP_STEP:-startup}"
  save_setup_state "failed"
  echo "" >&2
  echo "ERROR: aws-setup failed during step: ${SETUP_LAST_FAILED_STEP}" >&2
  echo "Saved resumable state to: $SETUP_STATE_FILE" >&2
  echo "Wrote readable report to: $SETUP_REPORT_FILE" >&2
  echo "After fixing the issue, resume with:" >&2
  echo "  SETUP_RESUME=1 bash infra/init/aws-setup.sh" >&2
  exit "$exit_code"
}

run_setup_step() {
  local step_id="$1"
  local label="$2"
  local started_at finished_at elapsed
  shift 2

  echo ""
  echo "==> Starting: $label"
  CURRENT_SETUP_STEP="$step_id"
  SETUP_LAST_STARTED_STEP="$step_id"
  save_setup_state "running:$step_id"
  started_at="$(date +%s)"
  "$@"
  finished_at="$(date +%s)"
  elapsed=$((finished_at - started_at))
  mark_setup_step_completed "$step_id"
  SETUP_LAST_SUCCESSFUL_STEP="$step_id"
  SETUP_LAST_FAILED_STEP=""
  save_setup_state "completed:$step_id"
  echo "==> Finished: $label (${elapsed}s)"
  echo "    State: $SETUP_STATE_FILE"
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

get_key_pair_id() {
  local key_name="$1"
  aws_region ec2 describe-key-pairs \
    --key-names "$key_name" \
    --query 'KeyPairs[0].KeyPairId' \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }'
}

get_availability_zone() {
  local index="$1"
  aws_region ec2 describe-availability-zones \
    --filters "Name=state,Values=available" \
    --query "AvailabilityZones[${index}].ZoneName" \
    --output text
}

require_availability_zones() {
  local required_count="$1"
  local available_count

  available_count=$(aws_region ec2 describe-availability-zones \
    --filters "Name=state,Values=available" \
    --query 'length(AvailabilityZones)' \
    --output text)
  if [ "$available_count" -lt "$required_count" ]; then
    echo "ERROR: $AWS_REGION has $available_count available Availability Zones; $required_count are required." >&2
    return 1
  fi
}

bool_flag() {
  local value="$1"
  if [ "$value" = "1" ] || [ "$value" = "true" ] || [ "$value" = "TRUE" ]; then
    printf "true"
  else
    printf "false"
  fi
}

tag_ec2_resource() {
  local resource_id="$1"
  local name="$2"
  aws_region ec2 create-tags \
    --resources "$resource_id" \
    --tags $(default_tag_pairs "$name") >/dev/null
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

get_security_group_id() {
  local group_name="$1"
  local vpc_id="$2"
  aws_region ec2 describe-security-groups \
    --filters "Name=group-name,Values=${group_name}" "Name=vpc-id,Values=${vpc_id}" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }'
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

revoke_default_security_group_ingress() {
  local group_id="$1"

  aws_region ec2 revoke-security-group-ingress \
    --group-id "$group_id" \
    --protocol -1 \
    --source-group "$group_id" >/dev/null 2>&1 || true
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

refresh_current_admin_ip() {
  MY_IP="$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')/32"
}

ensure_current_admin_ip() {
  if [ -z "${MY_IP:-}" ]; then
    refresh_current_admin_ip
  fi
}

refresh_rds_admin_ingress_group() {
  local label="$1"
  local group_id="$2"
  local enabled="$3"
  local cidr
  local revoked_count
  revoked_count=0

  if [ "$enabled" != "1" ]; then
    echo "    Skipping $label; local admin ingress disabled."
    return
  fi

  if [ -z "$group_id" ]; then
    echo "    Skipping $label; security group not found."
    return
  fi

  while IFS= read -r cidr; do
    [ -n "$cidr" ] || continue
    [ "$cidr" != "None" ] || continue
    [ "$cidr" = "$MY_IP" ] && continue
    echo "    Revoking stale $label CIDR: $cidr"
    aws_region ec2 revoke-security-group-ingress \
      --group-id "$group_id" \
      --protocol tcp \
      --port "$RDS_PORT" \
      --cidr "$cidr" >/dev/null 2>&1 || true
    revoked_count=$((revoked_count + 1))
  done < <(
    aws_region ec2 describe-security-groups \
      --group-ids "$group_id" \
      --query "SecurityGroups[0].IpPermissions[?FromPort==\`${RDS_PORT}\` && ToPort==\`${RDS_PORT}\` && IpProtocol=='tcp'].IpRanges[].CidrIp" \
      --output text | tr '\t' '\n'
  )

  authorize_tcp_from_cidr "$group_id" "$RDS_PORT" "$MY_IP"
  echo "    $label allows $MY_IP on $RDS_PORT; revoked stale CIDRs: $revoked_count"
}

refresh_rds_admin_ingress() {
  local prod_vpc_id dev_vpc_id prod_rds_sg_id dev_rds_sg_id

  echo ""
  echo ">>> RDS admin ingress refresh"

  if [ "$REFRESH_RDS_ADMIN_IP" != "1" ]; then
    echo "    REFRESH_RDS_ADMIN_IP=0, skipped RDS admin ingress refresh."
    return
  fi

  refresh_current_admin_ip
  echo "    Current admin CIDR: $MY_IP"

  prod_vpc_id="$(get_single_id_by_name ec2 describe-vpcs "$VPC_NAME" 'Vpcs[0].VpcId')"
  dev_vpc_id="$(get_single_id_by_name ec2 describe-vpcs "$DEV_VPC_NAME" 'Vpcs[0].VpcId')"

  prod_rds_sg_id=""
  dev_rds_sg_id=""
  if [ -n "$prod_vpc_id" ]; then
    prod_rds_sg_id="$(get_security_group_id "$PROD_RDS_SG_NAME" "$prod_vpc_id")"
  fi
  if [ -n "$dev_vpc_id" ]; then
    dev_rds_sg_id="$(get_security_group_id "$DEV_RDS_SG_NAME" "$dev_vpc_id")"
  fi

  refresh_rds_admin_ingress_group "$PROD_RDS_IDENTIFIER" "$prod_rds_sg_id" "$PROD_RDS_ALLOW_LOCAL_ADMIN"
  refresh_rds_admin_ingress_group "$DEV_RDS_IDENTIFIER" "$dev_rds_sg_id" "1"
}

get_rds_endpoint() {
  local db_identifier="$1"
  aws_region rds describe-db-instances \
    --db-instance-identifier "$db_identifier" \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }'
}

ensure_db_subnet_group() {
  local subnet_group_name="$1"
  local description="$2"
  local subnet_group_arn
  shift 2

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
    --tags $(default_tag_pairs "$subnet_group_name") >/dev/null
}

ensure_postgres_rds_instance() {
  local db_identifier="$1"
  local subnet_group_name="$2"
  local security_group_id="$3"
  local master_password="$4"
  local publicly_accessible="$5"
  local deletion_protection="$6"
  local multi_az="$7"
  local public_flag deletion_flag multi_az_flag db_instance_arn

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
    echo "    Reusing RDS instance: $db_identifier"
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
      --db-name "$RDS_DB_NAME" \
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
      --tags $(default_tag_pairs "$db_identifier") >/dev/null
    echo "    Created RDS instance: $db_identifier"
  fi

  aws_region rds wait db-instance-available --db-instance-identifier "$db_identifier"
  db_instance_arn=$(aws_region rds describe-db-instances \
    --db-instance-identifier "$db_identifier" \
    --query 'DBInstances[0].DBInstanceArn' \
    --output text)
  aws_region rds add-tags-to-resource \
    --resource-name "$db_instance_arn" \
    --tags $(default_tag_pairs "$db_identifier") >/dev/null
}

postgres_url() {
  local username="$1"
  local password="$2"
  local host="$3"
  local db_name="$4"
  local encoded_username encoded_password encoded_db_name
  encoded_username="$(jq -rn --arg value "$username" '$value|@uri')"
  encoded_password="$(jq -rn --arg value "$password" '$value|@uri')"
  encoded_db_name="$(jq -rn --arg value "$db_name" '$value|@uri')"
  printf 'postgres://%s:%s@%s:%s/%s?sslmode=require' \
    "$encoded_username" "$encoded_password" "$host" "$RDS_PORT" "$encoded_db_name"
}

ensure_policy() {
  local policy_name="$1"
  local policy_document="$2"
  local policy_arn version_count oldest_non_default_version

  policy_arn=$(aws iam list-policies \
    --scope Local \
    --query "Policies[?PolicyName=='${policy_name}'].Arn | [0]" \
    --output text)

  if [ -z "$policy_arn" ] || [ "$policy_arn" = "None" ]; then
    policy_arn=$(aws iam create-policy \
      --policy-name "$policy_name" \
      --policy-document "$policy_document" \
      --tags $(default_tag_pairs "$policy_name") \
      --query 'Policy.Arn' \
      --output text)
  else
    version_count=$(aws iam list-policy-versions \
      --policy-arn "$policy_arn" \
      --query 'length(Versions)' \
      --output text)

    if [ "$version_count" -ge 5 ]; then
      # shellcheck disable=SC2016
      oldest_non_default_version=$(aws iam list-policy-versions \
        --policy-arn "$policy_arn" \
        --query 'sort_by(Versions[?IsDefaultVersion==`false`], &CreateDate)[0].VersionId' \
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
    --tags $(default_tag_pairs "$policy_name") >/dev/null

  printf '%s' "$policy_arn"
}

ensure_role() {
  local role_name="$1"
  local trust_policy="$2"
  local role_arn

  role_arn=$(aws iam get-role \
    --role-name "$role_name" \
    --query 'Role.Arn' \
    --output text 2>/dev/null || true)

  if [ -z "$role_arn" ]; then
    role_arn=$(aws iam create-role \
      --role-name "$role_name" \
      --assume-role-policy-document "$trust_policy" \
      --tags $(default_tag_pairs "$role_name") \
      --query 'Role.Arn' \
      --output text)
  else
    aws iam update-assume-role-policy \
      --role-name "$role_name" \
      --policy-document "$trust_policy" >/dev/null
  fi

  aws iam tag-role \
    --role-name "$role_name" \
    --tags $(default_tag_pairs "$role_name") >/dev/null

  printf '%s' "$role_arn"
}

ensure_bucket() {
  local bucket="$1"
  if aws_region s3api head-bucket --bucket "$bucket" >/dev/null 2>&1; then
    echo "    Reusing bucket: s3://$bucket"
  else
    echo "    Creating bucket: s3://$bucket"
    if [ "$AWS_REGION" = "us-east-1" ]; then
      aws_region s3api create-bucket \
        --bucket "$bucket" >/dev/null
    else
      aws_region s3api create-bucket \
        --bucket "$bucket" \
        --create-bucket-configuration LocationConstraint="$AWS_REGION" >/dev/null
    fi
  fi

  aws_region s3api put-bucket-tagging \
    --bucket "$bucket" \
    --tagging "TagSet=[{Key=Name,Value=${bucket}},{Key=Project,Value=${PROJECT_NAME}}]" >/dev/null

  aws_region s3api put-public-access-block \
    --bucket "$bucket" \
    --public-access-block-configuration \
      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

  aws_region s3api put-bucket-encryption \
    --bucket "$bucket" \
    --server-side-encryption-configuration \
      '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true,"BlockedEncryptionTypes":{"EncryptionType":["SSE-C"]}}]}'
  aws_region s3api get-bucket-encryption --bucket "$bucket" >/dev/null

  aws_region s3api put-bucket-versioning \
    --bucket "$bucket" \
    --versioning-configuration Status=Enabled >/dev/null
  aws_region s3api get-bucket-versioning --bucket "$bucket" >/dev/null

  ensure_bucket_https_only_policy "$bucket"
}

ensure_bucket_https_only_policy() {
  local bucket="$1"
  local existing_policy merged_policy backup_path

  existing_policy="$(aws_region s3api get-bucket-policy --bucket "$bucket" --query Policy --output text 2>/dev/null || true)"
  if [ -z "$existing_policy" ] || [ "$existing_policy" = "None" ]; then
    existing_policy='{"Version":"2012-10-17","Statement":[]}'
  else
    mkdir -p "$SETUP_STATE_DIR"
    backup_path="${SETUP_STATE_DIR}/${bucket}-policy-backup-$(date +%s).json"
    printf '%s\n' "$existing_policy" > "$backup_path"
    chmod 600 "$backup_path" 2>/dev/null || true
    echo "    Backed up existing bucket policy: $backup_path"
  fi

  merged_policy="$(jq -c --arg bucket "$bucket" '
    .Version = (.Version // "2012-10-17")
    | .Statement = (
        (.Statement // [])
        | if type == "array" then . else [.] end
        | map(select(.Sid != "DenyInsecureTransport"))
        + [{
            "Sid": "DenyInsecureTransport",
            "Effect": "Deny",
            "Principal": "*",
            "Action": "s3:*",
            "Resource": ["arn:aws:s3:::\($bucket)/*", "arn:aws:s3:::\($bucket)"],
            "Condition": {"Bool": {"aws:SecureTransport": "false"}}
          }]
      )
  ' <<<"$existing_policy")"

  jq -e . >/dev/null <<<"$merged_policy"
  aws_region s3api put-bucket-policy --bucket "$bucket" --policy "$merged_policy" >/dev/null
  aws_region s3api get-bucket-policy --bucket "$bucket" --output text >/dev/null
}

ensure_ec2_bootstrap_instance_profile() {
  local trust_policy role_arn

  trust_policy='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
  role_arn="$(ensure_role "$EC2_ROLE_NAME" "$trust_policy")"
  aws iam attach-role-policy \
    --role-name "$EC2_ROLE_NAME" \
    --policy-arn "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore" >/dev/null
  ensure_instance_profile "$EC2_ROLE_NAME" "$EC2_INSTANCE_PROFILE_NAME"
  EC2_ROLE_ARN="$role_arn"
}

ensure_vpc_flow_logs() {
  local vpc_id="$1"
  local role_policy role_arn flow_log_id log_group_arn

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
  aws iam tag-role --role-name "$VPC_FLOW_LOG_ROLE_NAME" --tags $(default_tag_pairs "$VPC_FLOW_LOG_ROLE_NAME") >/dev/null

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
      --tag-specifications "$(default_ec2_tag_spec vpc-flow-log "${PROJECT_NAME}-flow-log")" \
      --query 'FlowLogIds[0]' \
      --output text)
  fi

  aws_region logs tag-resource \
    --resource-arn "$log_group_arn" \
    --tags "Name=${PROJECT_NAME}-flow-logs,Project=${PROJECT_NAME},Environment=${ENVIRONMENT}" >/dev/null 2>&1 || true
  VPC_FLOW_LOG_ID="$flow_log_id"
  printf '%s' "$flow_log_id"
}

ensure_ecr_repository() {
  local repository_name="$1"
  local repository_arn lifecycle_policy
  if aws_region ecr describe-repositories --repository-names "$repository_name" >/dev/null 2>&1; then
    echo "    Reusing ECR repository: $repository_name"
  else
    aws_region ecr create-repository \
      --repository-name "$repository_name" \
      --image-scanning-configuration scanOnPush=true \
      --image-tag-mutability IMMUTABLE \
      --encryption-configuration encryptionType=AES256 \
      --tags $(default_tag_pairs "$repository_name") >/dev/null
    echo "    Created ECR repository: $repository_name"
  fi

  aws_region ecr put-image-scanning-configuration \
    --repository-name "$repository_name" \
    --image-scanning-configuration scanOnPush=true >/dev/null
  aws_region ecr put-image-tag-mutability \
    --repository-name "$repository_name" \
    --image-tag-mutability IMMUTABLE >/dev/null
  lifecycle_policy="$(jq -cn --argjson days "$ECR_UNTAGGED_IMAGE_RETENTION_DAYS" '
    {
      rules: [
        {
          rulePriority: 1,
          description: "Expire untagged images after the configured retention window",
          selection: {
            tagStatus: "untagged",
            countType: "sinceImagePushed",
            countUnit: "days",
            countNumber: $days
          },
          action: { type: "expire" }
        }
      ]
    }
  ')"
  aws_region ecr put-lifecycle-policy \
    --repository-name "$repository_name" \
    --lifecycle-policy-text "$lifecycle_policy" >/dev/null

  repository_arn=$(aws_region ecr describe-repositories \
    --repository-names "$repository_name" \
    --query 'repositories[0].repositoryArn' \
    --output text)
  aws_region ecr tag-resource \
    --resource-arn "$repository_arn" \
    --tags $(default_tag_pairs "$repository_name") >/dev/null
}

ensure_oidc_provider() {
  local provider_arn

  provider_arn=$(aws iam list-open-id-connect-providers \
    --query "OpenIDConnectProviderList[?contains(Arn, 'token.actions.githubusercontent.com')].Arn | [0]" \
    --output text)

  if [ -z "$provider_arn" ] || [ "$provider_arn" = "None" ]; then
    provider_arn=$(aws iam create-open-id-connect-provider \
      --url "$GITHUB_OIDC_PROVIDER_URL" \
      --client-id-list sts.amazonaws.com \
      --tags $(default_tag_pairs "$GITHUB_OIDC_PROVIDER_NAME") \
      --query 'OpenIDConnectProviderArn' \
      --output text)
  fi

  aws iam tag-open-id-connect-provider \
    --open-id-connect-provider-arn "$provider_arn" \
    --tags $(default_tag_pairs "$GITHUB_OIDC_PROVIDER_NAME") >/dev/null

  printf '%s' "$provider_arn"
}

ensure_instance_profile() {
  local role_name="$1"
  local profile_name="$2"

  aws iam get-instance-profile --instance-profile-name "$profile_name" >/dev/null 2>&1 \
    || aws iam create-instance-profile \
      --instance-profile-name "$profile_name" \
      --tags $(default_tag_pairs "$profile_name") >/dev/null

  aws iam tag-instance-profile \
    --instance-profile-name "$profile_name" \
    --tags $(default_tag_pairs "$profile_name") >/dev/null

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

remote_run() {
  local elastic_ip="$1"
  shift
  ssh \
    -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout="$SSH_CONNECT_TIMEOUT" \
    -i "$SSH_PRIVATE_KEY_PATH" \
    "ec2-user@${elastic_ip}" "$@"
}

remote_probe() {
  local elastic_ip="$1"
  ssh \
    -o BatchMode=yes \
    -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout="$SSH_CONNECT_TIMEOUT" \
    -i "$SSH_PRIVATE_KEY_PATH" \
    "ec2-user@${elastic_ip}" true
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
