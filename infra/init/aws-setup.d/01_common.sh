#!/usr/bin/env bash

INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
PROD_ENV_FILE="${PROD_ENV_FILE:-${INFRA_DIR}/.env.prod}"
EXAMPLE_SECRETS_DIR="${EXAMPLE_SECRETS_DIR:-${INFRA_DIR}/example-secrets}"
SECRET_DRAFT_DIR="${SECRET_DRAFT_DIR:-${SCRIPT_DIR}/local-secrets}"

load_local_env() {
  if [ -f "$LOCAL_ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$LOCAL_ENV_FILE"
    set +a
  fi
}

configure_defaults() {
  PROJECT_NAME="${PROJECT_NAME:-dokumen}"
  AWS_REGION="${AWS_REGION:-us-east-1}"
  INSTANCE_TYPE="${INSTANCE_TYPE:-t3.medium}"
  DOMAIN="${DOMAIN:-dokumenai.dev}"
  REPO_URL="${REPO_URL:-https://github.com/optimalcharb/pdf-ner.git}"
  DEPLOY_BRANCH="${DEPLOY_BRANCH:-}"
  GITHUB_REPO="${GITHUB_REPO:-}"

  KEY_NAME="${KEY_NAME:-${PROJECT_NAME}-ec2}"
  SSH_PUBKEY_PATH="${SSH_PUBKEY_PATH:-$HOME/.ssh/${PROJECT_NAME}-ec2.pub}"
  SSH_PRIVATE_KEY_PATH="${SSH_PRIVATE_KEY_PATH:-$HOME/.ssh/${PROJECT_NAME}-ec2}"
  REMOTE_APP_DIR="${REMOTE_APP_DIR:-/opt/${PROJECT_NAME}/pdf-ner}"
  DO_DEPLOY="${DO_DEPLOY:-1}"
  UPLOAD_LOCAL_ENV="${UPLOAD_LOCAL_ENV:-1}"
  START_COMPOSE="${START_COMPOSE:-1}"

  SES_IDENTITY_EMAIL="${SES_IDENTITY_EMAIL:-no-reply@${DOMAIN}}"

  VPC_CIDR="${VPC_CIDR:-10.40.0.0/16}"
  PUBLIC_SUBNET_CIDR="${PUBLIC_SUBNET_CIDR:-10.40.1.0/24}"

  VPC_NAME="${PROJECT_NAME}-vpc"
  SUBNET_NAME="${PROJECT_NAME}-public-subnet"
  IGW_NAME="${PROJECT_NAME}-igw"
  ROUTE_TABLE_NAME="${PROJECT_NAME}-public-rt"
  SG_NAME="${PROJECT_NAME}-ec2-sg"
  INSTANCE_NAME="${PROJECT_NAME}-ec2"
  EIP_NAME="${PROJECT_NAME}-eip"

  WEB_ECR_REPOSITORY="${WEB_ECR_REPOSITORY:-${PROJECT_NAME}-web}"
  API_ECR_REPOSITORY="${API_ECR_REPOSITORY:-${PROJECT_NAME}-api}"
  WORKERS_ECR_REPOSITORY="${WORKERS_ECR_REPOSITORY:-${PROJECT_NAME}-workers}"
  GPU_DEEPSEEK_ECR_REPOSITORY="${GPU_DEEPSEEK_ECR_REPOSITORY:-${PROJECT_NAME}-deepseek-ocr}"
  GPU_OLM_OCR2_ECR_REPOSITORY="${GPU_OLM_OCR2_ECR_REPOSITORY:-${PROJECT_NAME}-olm-ocr2}"
  EC2_ROLE_NAME="${PROJECT_NAME}-ec2-runtime-role"
  EC2_INSTANCE_PROFILE_NAME="${PROJECT_NAME}-ec2-instance-profile"
  EC2_RUNTIME_POLICY_NAME="${PROJECT_NAME}-ec2-runtime"
  GITHUB_DEPLOY_ROLE_NAME="${PROJECT_NAME}-github-deploy"
  GITHUB_DEPLOY_POLICY_NAME="${PROJECT_NAME}-github-deploy"
  GITHUB_OIDC_PROVIDER_URL="https://token.actions.githubusercontent.com"
  GITHUB_OIDC_THUMBPRINT="${GITHUB_OIDC_THUMBPRINT:-6938fd4d98bab03faadb97b34396831e3780aea1}"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1" >&2
    exit 1
  fi
}

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "ERROR: required environment variable is not set: $name" >&2
    echo "Set it in $LOCAL_ENV_FILE or export it before running this script." >&2
    exit 1
  fi
}

aws_region() {
  aws --region "$AWS_REGION" "$@"
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
      --query 'Role.Arn' \
      --output text)
  else
    aws iam update-assume-role-policy \
      --role-name "$role_name" \
      --policy-document "$trust_policy" >/dev/null
  fi

  printf '%s' "$role_arn"
}

ensure_bucket() {
  local bucket="$1"
  if aws_region s3api head-bucket --bucket "$bucket" >/dev/null 2>&1; then
    echo "    Reusing bucket: s3://$bucket"
  else
    echo "    Creating bucket: s3://$bucket"
    if [ "$AWS_REGION" = "us-east-1" ]; then
      aws_region s3api create-bucket --bucket "$bucket" >/dev/null
    else
      aws_region s3api create-bucket \
        --bucket "$bucket" \
        --create-bucket-configuration LocationConstraint="$AWS_REGION" >/dev/null
    fi
  fi

  aws_region s3api put-public-access-block \
    --bucket "$bucket" \
    --public-access-block-configuration \
      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

  aws_region s3api put-bucket-encryption \
    --bucket "$bucket" \
    --server-side-encryption-configuration \
      '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
}

ensure_ecr_repository() {
  local repository_name="$1"
  if aws_region ecr describe-repositories --repository-names "$repository_name" >/dev/null 2>&1; then
    echo "    Reusing ECR repository: $repository_name"
  else
    aws_region ecr create-repository \
      --repository-name "$repository_name" \
      --image-scanning-configuration scanOnPush=true \
      --encryption-configuration encryptionType=AES256 >/dev/null
    echo "    Created ECR repository: $repository_name"
  fi
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
      --thumbprint-list "$GITHUB_OIDC_THUMBPRINT" \
      --query 'OpenIDConnectProviderArn' \
      --output text)
  fi

  printf '%s' "$provider_arn"
}

ensure_instance_profile() {
  local role_name="$1"
  local profile_name="$2"

  aws iam get-instance-profile --instance-profile-name "$profile_name" >/dev/null 2>&1 \
    || aws iam create-instance-profile --instance-profile-name "$profile_name" >/dev/null

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
  ssh -o StrictHostKeyChecking=accept-new -i "$SSH_PRIVATE_KEY_PATH" "ec2-user@${elastic_ip}" "$@"
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
