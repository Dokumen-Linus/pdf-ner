#!/usr/bin/env bash
# =============================================================================
# Dokumen AI - AWS infrastructure and EC2 Compose deployment
# =============================================================================
#
# Creates or reuses:
#   - VPC, public subnet, internet gateway, route table
#   - Security group for SSH, HTTP, HTTPS, and Nginx Proxy Manager admin
#   - EC2 instance with an Elastic IP
#   - ECR repositories for web, API, and workers images
#   - EC2 instance profile for SSM, ECR pull, and Secrets Manager reads
#   - GitHub Actions OIDC deploy role for ECR push and SSM deployments
#   - Private S3 bucket for avatars
#   - IAM users/access keys for SES, avatar S3, and PDF-storage S3 bucket creation
#   - Optional SES email identity verification request
#
# Deploys:
#   - Installs Docker on Amazon Linux 2023
#   - Clones or updates the repo on EC2
#   - Optionally uploads local infra/.env.prod and starts docker compose
#
# Usage:
#   chmod +x infra/aws-setup.sh
#   bash infra/aws-setup.sh
#
# Common overrides:
#   cp infra/.env.local.example infra/.env.local
#   cp infra/.env.prod.example infra/.env.prod
#   bash infra/aws-setup.sh
#   DO_DEPLOY=0 bash infra/aws-setup.sh
#
# Notes:
#   - The AWS CLI credentials used to run this script are deployer credentials.
#   - App runtime credentials are created separately and should be least-privilege.
#   - On EC2, IAM roles are preferred over long-lived access keys, but the current
#     app persists per-bucket S3 credentials, so this script creates scoped keys.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
PROD_ENV_FILE="${PROD_ENV_FILE:-${SCRIPT_DIR}/.env.prod}"

if [ -f "$LOCAL_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$LOCAL_ENV_FILE"
  set +a
fi

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

SES_IAM_USER_NAME="${PROJECT_NAME}-ses-user"
SES_POLICY_NAME="${PROJECT_NAME}-ses-send-email"
AVATARS_IAM_USER_NAME="${PROJECT_NAME}-avatars-s3-user"
AVATARS_POLICY_NAME="${PROJECT_NAME}-avatars-s3"
PDF_STORAGE_IAM_USER_NAME="${PROJECT_NAME}-pdf-storage-s3-user"
PDF_STORAGE_POLICY_NAME="${PROJECT_NAME}-pdf-storage-s3-admin"

WEB_ECR_REPOSITORY="${WEB_ECR_REPOSITORY:-${PROJECT_NAME}-web}"
API_ECR_REPOSITORY="${API_ECR_REPOSITORY:-${PROJECT_NAME}-api}"
WORKERS_ECR_REPOSITORY="${WORKERS_ECR_REPOSITORY:-${PROJECT_NAME}-workers}"
EC2_ROLE_NAME="${PROJECT_NAME}-ec2-runtime-role"
EC2_INSTANCE_PROFILE_NAME="${PROJECT_NAME}-ec2-instance-profile"
EC2_RUNTIME_POLICY_NAME="${PROJECT_NAME}-ec2-runtime"
GITHUB_DEPLOY_ROLE_NAME="${PROJECT_NAME}-github-deploy"
GITHUB_DEPLOY_POLICY_NAME="${PROJECT_NAME}-github-deploy"
GITHUB_OIDC_PROVIDER_URL="https://token.actions.githubusercontent.com"
GITHUB_OIDC_THUMBPRINT="${GITHUB_OIDC_THUMBPRINT:-6938fd4d98bab03faadb97b34396831e3780aea1}"

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

ensure_access_key() {
  local user_name="$1"
  local label="$2"
  local keys_json access_key_id secret_access_key existing_count

  aws iam create-user --user-name "$user_name" >/dev/null 2>&1 || true

  existing_count=$(aws iam list-access-keys \
    --user-name "$user_name" \
    --query 'length(AccessKeyMetadata)' \
    --output text)

  if [ "$existing_count" -ge 2 ]; then
    echo "    $label: $user_name already has 2 access keys; not creating another."
    echo "    Rotate/delete one manually if you need the secret value again."
    return
  fi

  keys_json=$(aws iam create-access-key --user-name "$user_name")
  access_key_id=$(printf '%s' "$keys_json" | jq -r '.AccessKey.AccessKeyId')
  secret_access_key=$(printf '%s' "$keys_json" | jq -r '.AccessKey.SecretAccessKey')

  cat <<EOF
    $label access key created for IAM user: $user_name
      ${label}_AWS_ACCESS_KEY_ID=$access_key_id
      ${label}_AWS_SECRET_ACCESS_KEY=$secret_access_key
EOF
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

echo "============================================="
echo "  Dokumen AI - AWS setup"
echo "============================================="
echo "Project:       $PROJECT_NAME"
echo "Region:        $AWS_REGION"
echo "Instance type: $INSTANCE_TYPE"
echo "Domain:        $DOMAIN"
echo "Repo:          $REPO_URL"
echo "Deploy:        $DO_DEPLOY"
echo "============================================="
echo ""

require_cmd aws
require_cmd curl
require_cmd jq
require_env DEPLOY_BRANCH
require_env GITHUB_REPO

if [ ! -f "$SSH_PUBKEY_PATH" ]; then
  echo "ERROR: SSH public key not found: $SSH_PUBKEY_PATH" >&2
  echo "Generate one with: ssh-keygen -t ed25519 -f ${SSH_PRIVATE_KEY_PATH}" >&2
  exit 1
fi

MY_IP="$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')/32"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
AVATARS_S3_BUCKET_NAME="${AVATARS_S3_BUCKET_NAME:-${PROJECT_NAME}-avatars-${ACCOUNT_ID}-${AWS_REGION}}"

echo "AWS account:   $ACCOUNT_ID"
echo "SSH allowed:   $MY_IP"
echo "Avatar bucket: $AVATARS_S3_BUCKET_NAME"
echo ""

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

echo ""
echo ">>> 4. EC2 instance"

AMI_ID=$(aws_region ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=al2023-ami-2023*-x86_64" "Name=state,Values=available" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text)

INSTANCE_ID="$(get_single_id_by_name ec2 describe-instances "$INSTANCE_NAME" 'Reservations[].Instances[?State.Name!=`terminated`].InstanceId | [0]')"
if [ -z "$INSTANCE_ID" ]; then
  INSTANCE_ID=$(aws_region ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SG_ID" \
    --subnet-id "$SUBNET_ID" \
    --metadata-options "HttpTokens=required,HttpEndpoint=enabled" \
    --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":40,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${INSTANCE_NAME}}]" \
    --query 'Instances[0].InstanceId' \
    --output text)
fi
aws_region ec2 wait instance-running --instance-ids "$INSTANCE_ID"
echo "    Instance: $INSTANCE_ID"

ALLOC_ID="$(aws_region ec2 describe-addresses \
  --filters "$(tag_value_filter "$EIP_NAME")" \
  --query 'Addresses[0].AllocationId' \
  --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }')"
if [ -z "$ALLOC_ID" ]; then
  ALLOC_ID=$(aws_region ec2 allocate-address \
    --domain vpc \
    --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=${EIP_NAME}}]" \
    --query 'AllocationId' \
    --output text)
fi
aws_region ec2 associate-address --instance-id "$INSTANCE_ID" --allocation-id "$ALLOC_ID" >/dev/null 2>&1 || true
ELASTIC_IP="$(aws_region ec2 describe-addresses --allocation-ids "$ALLOC_ID" --query 'Addresses[0].PublicIp' --output text)"
echo "    Elastic IP: $ELASTIC_IP"

echo ""
echo ">>> 5. ECR repositories and deployment IAM"

ensure_ecr_repository "$WEB_ECR_REPOSITORY"
ensure_ecr_repository "$API_ECR_REPOSITORY"
ensure_ecr_repository "$WORKERS_ECR_REPOSITORY"

EC2_TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
)

EC2_RUNTIME_POLICY_DOCUMENT=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer"
      ],
      "Resource": [
        "arn:aws:ecr:${AWS_REGION}:${ACCOUNT_ID}:repository/$(json_escape "$WEB_ECR_REPOSITORY")",
        "arn:aws:ecr:${AWS_REGION}:${ACCOUNT_ID}:repository/$(json_escape "$API_ECR_REPOSITORY")",
        "arn:aws:ecr:${AWS_REGION}:${ACCOUNT_ID}:repository/$(json_escape "$WORKERS_ECR_REPOSITORY")"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:${AWS_REGION}:${ACCOUNT_ID}:secret:prod/web-*",
        "arn:aws:secretsmanager:${AWS_REGION}:${ACCOUNT_ID}:secret:prod/email-*",
        "arn:aws:secretsmanager:${AWS_REGION}:${ACCOUNT_ID}:secret:prod/api-*",
        "arn:aws:secretsmanager:${AWS_REGION}:${ACCOUNT_ID}:secret:prod/workers-*",
        "arn:aws:secretsmanager:${AWS_REGION}:${ACCOUNT_ID}:secret:prod/runpod-*"
      ]
    }
  ]
}
EOF
)

EC2_ROLE_ARN=$(ensure_role "$EC2_ROLE_NAME" "$EC2_TRUST_POLICY")
EC2_RUNTIME_POLICY_ARN=$(ensure_policy "$EC2_RUNTIME_POLICY_NAME" "$EC2_RUNTIME_POLICY_DOCUMENT")
aws iam attach-role-policy --role-name "$EC2_ROLE_NAME" --policy-arn "$EC2_RUNTIME_POLICY_ARN"
aws iam attach-role-policy --role-name "$EC2_ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
ensure_instance_profile "$EC2_ROLE_NAME" "$EC2_INSTANCE_PROFILE_NAME"
sleep 30
ensure_instance_profile_attached "$INSTANCE_ID" "$EC2_INSTANCE_PROFILE_NAME"
echo "    EC2 runtime role: $EC2_ROLE_ARN"
echo "    EC2 instance profile: $EC2_INSTANCE_PROFILE_NAME"

GITHUB_OIDC_PROVIDER_ARN=$(ensure_oidc_provider)
GITHUB_TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "$(json_escape "$GITHUB_OIDC_PROVIDER_ARN")"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:$(json_escape "$GITHUB_REPO"):ref:refs/heads/$(json_escape "$DEPLOY_BRANCH")"
        }
      }
    }
  ]
}
EOF
)

GITHUB_DEPLOY_POLICY_DOCUMENT=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:CreateRepository",
        "ecr:DescribeRepositories",
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:CompleteLayerUpload",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart"
      ],
      "Resource": [
        "arn:aws:ecr:${AWS_REGION}:${ACCOUNT_ID}:repository/$(json_escape "$WEB_ECR_REPOSITORY")",
        "arn:aws:ecr:${AWS_REGION}:${ACCOUNT_ID}:repository/$(json_escape "$API_ECR_REPOSITORY")",
        "arn:aws:ecr:${AWS_REGION}:${ACCOUNT_ID}:repository/$(json_escape "$WORKERS_ECR_REPOSITORY")"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:SendCommand"
      ],
      "Resource": [
        "arn:aws:ec2:${AWS_REGION}:${ACCOUNT_ID}:instance/${INSTANCE_ID}",
        "arn:aws:ssm:${AWS_REGION}::document/AWS-RunShellScript"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetCommandInvocation",
        "ssm:ListCommandInvocations"
      ],
      "Resource": "*"
    }
  ]
}
EOF
)

GITHUB_DEPLOY_ROLE_ARN=$(ensure_role "$GITHUB_DEPLOY_ROLE_NAME" "$GITHUB_TRUST_POLICY")
GITHUB_DEPLOY_POLICY_ARN=$(ensure_policy "$GITHUB_DEPLOY_POLICY_NAME" "$GITHUB_DEPLOY_POLICY_DOCUMENT")
aws iam attach-role-policy --role-name "$GITHUB_DEPLOY_ROLE_NAME" --policy-arn "$GITHUB_DEPLOY_POLICY_ARN"
echo "    GitHub OIDC provider: $GITHUB_OIDC_PROVIDER_ARN"
echo "    GitHub deploy role: $GITHUB_DEPLOY_ROLE_ARN"

echo ""
echo ">>> 6. S3 and IAM runtime credentials"

ensure_bucket "$AVATARS_S3_BUCKET_NAME"

SES_POLICY_DOCUMENT=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    }
  ]
}
EOF
)

AVATARS_POLICY_DOCUMENT=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": [
        "arn:aws:s3:::$(json_escape "$AVATARS_S3_BUCKET_NAME")",
        "arn:aws:s3:::$(json_escape "$AVATARS_S3_BUCKET_NAME")/*"
      ]
    }
  ]
}
EOF
)

PDF_STORAGE_POLICY_DOCUMENT=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:HeadBucket",
        "s3:GetBucketLocation",
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:PutLifecycleConfiguration",
        "s3:GetLifecycleConfiguration",
        "s3:PutBucketPublicAccessBlock",
        "s3:PutBucketEncryption"
      ],
      "Resource": ["arn:aws:s3:::*", "arn:aws:s3:::*/*"]
    }
  ]
}
EOF
)

SES_POLICY_ARN=$(ensure_policy "$SES_POLICY_NAME" "$SES_POLICY_DOCUMENT")
AVATARS_POLICY_ARN=$(ensure_policy "$AVATARS_POLICY_NAME" "$AVATARS_POLICY_DOCUMENT")
PDF_STORAGE_POLICY_ARN=$(ensure_policy "$PDF_STORAGE_POLICY_NAME" "$PDF_STORAGE_POLICY_DOCUMENT")

aws iam create-user --user-name "$SES_IAM_USER_NAME" >/dev/null 2>&1 || true
aws iam create-user --user-name "$AVATARS_IAM_USER_NAME" >/dev/null 2>&1 || true
aws iam create-user --user-name "$PDF_STORAGE_IAM_USER_NAME" >/dev/null 2>&1 || true
aws iam attach-user-policy --user-name "$SES_IAM_USER_NAME" --policy-arn "$SES_POLICY_ARN"
aws iam attach-user-policy --user-name "$AVATARS_IAM_USER_NAME" --policy-arn "$AVATARS_POLICY_ARN"
aws iam attach-user-policy --user-name "$PDF_STORAGE_IAM_USER_NAME" --policy-arn "$PDF_STORAGE_POLICY_ARN"

ensure_access_key "$SES_IAM_USER_NAME" "SES"
ensure_access_key "$AVATARS_IAM_USER_NAME" "AVATARS"
ensure_access_key "$PDF_STORAGE_IAM_USER_NAME" "PDF_STORAGE"

echo ""
echo ">>> 7. SES identity"
aws_region ses verify-email-identity --email-address "$SES_IDENTITY_EMAIL" >/dev/null 2>&1 || true
echo "    Verification email requested for: $SES_IDENTITY_EMAIL"
echo "    SES can send production email only after identity verification and sandbox exit."

if [ "$DO_DEPLOY" = "1" ]; then
  echo ""
  echo ">>> 8. EC2 deployment"
  require_cmd ssh
  require_cmd scp

  echo "    Waiting for SSH..."
  for _ in $(seq 1 30); do
    if remote_run "$ELASTIC_IP" "true" >/dev/null 2>&1; then
      break
    fi
    sleep 30e
  done

  remote_run "$ELASTIC_IP" "sudo dnf update -y && sudo dnf install -y docker git awscli amazon-ssm-agent && sudo systemctl enable --now docker amazon-ssm-agent && sudo usermod -aG docker ec2-user"
  remote_run "$ELASTIC_IP" "sudo install -d -o ec2-user -g ec2-user '$REMOTE_APP_DIR'"
  remote_run "$ELASTIC_IP" "if [ -d '$REMOTE_APP_DIR/.git' ]; then cd '$REMOTE_APP_DIR' && git fetch origin && git checkout '$DEPLOY_BRANCH' && git pull --ff-only origin '$DEPLOY_BRANCH'; else git clone --branch '$DEPLOY_BRANCH' '$REPO_URL' '$REMOTE_APP_DIR'; fi"

  if [ "$UPLOAD_LOCAL_ENV" = "1" ] && [ -f "$PROD_ENV_FILE" ]; then
    scp -i "$SSH_PRIVATE_KEY_PATH" "$PROD_ENV_FILE" "ec2-user@${ELASTIC_IP}:${REMOTE_APP_DIR}/infra/.env.prod"
    echo "    Uploaded local infra/.env.prod"
  else
    echo "    No infra/.env.prod uploaded. Create ${REMOTE_APP_DIR}/infra/.env.prod before starting Compose."
  fi

  if [ "$START_COMPOSE" = "1" ]; then
    remote_run "$ELASTIC_IP" "cd '$REMOTE_APP_DIR' && docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build"
  else
    echo "    START_COMPOSE=0, skipped docker compose startup."
  fi
fi

cat <<EOF

=============================================
  SETUP COMPLETE
=============================================

EC2 instance:       $INSTANCE_ID
Elastic IP:         $ELASTIC_IP
VPC:                $VPC_ID
Public subnet:      $SUBNET_ID
Security group:     $SG_ID
EC2 runtime role:   $EC2_ROLE_ARN
GitHub deploy role: $GITHUB_DEPLOY_ROLE_ARN
ECR web repo:       ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${WEB_ECR_REPOSITORY}
ECR API repo:       ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${API_ECR_REPOSITORY}
ECR workers repo:   ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${WORKERS_ECR_REPOSITORY}
Avatar S3 bucket:   $AVATARS_S3_BUCKET_NAME
SES identity email: $SES_IDENTITY_EMAIL

DNS records to create in Cloudflare:
  A    @      $ELASTIC_IP
  A    www    $ELASTIC_IP

SSH:
  ssh -i "$SSH_PRIVATE_KEY_PATH" ec2-user@$ELASTIC_IP

Put these values in the AWS Secrets Manager JSON files, not production infra/.env.prod:
  SES_AWS_ACCESS_KEY_ID / SES_AWS_SECRET_ACCESS_KEY
  PDF_STORAGE_AWS_ACCESS_KEY_ID / PDF_STORAGE_AWS_SECRET_ACCESS_KEY
  AVATARS_AWS_ACCESS_KEY_ID / AVATARS_AWS_SECRET_ACCESS_KEY
  AVATARS_S3_BUCKET_NAME=$AVATARS_S3_BUCKET_NAME
  SES_AWS_REGION=$AWS_REGION
  PDF_STORAGE_AWS_REGION=$AWS_REGION
  AVATARS_AWS_REGION=$AWS_REGION

Nginx Proxy Manager:
  http://$ELASTIC_IP:81

GitHub Actions secrets:
  AWS_GITHUB_DEPLOY_ROLE_ARN=$GITHUB_DEPLOY_ROLE_ARN
  EC2_INSTANCE_ID=$INSTANCE_ID

GitHub Actions variables:
  AWS_REGION=$AWS_REGION
  API_ECR_REPOSITORY=$API_ECR_REPOSITORY
  WEB_ECR_REPOSITORY=$WEB_ECR_REPOSITORY
  WORKERS_ECR_REPOSITORY=$WORKERS_ECR_REPOSITORY
  EC2_APP_DIR=$REMOTE_APP_DIR
  VITE_BASE_URL=https://$DOMAIN
  VITE_STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable-key>

EOF
