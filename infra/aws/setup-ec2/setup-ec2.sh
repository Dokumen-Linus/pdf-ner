#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/aws/shared/common.sh
. "${SCRIPT_DIR}/../shared/common.sh"
# shellcheck source=infra/aws/setup-ec2/setup-ecr.sh
. "${SCRIPT_DIR}/setup-ecr.sh"
# shellcheck source=infra/aws/setup-ec2/setup-key-pair.sh
. "${SCRIPT_DIR}/setup-key-pair.sh"
# shellcheck source=infra/aws/setup-ec2/setup-instance-profile.sh
. "${SCRIPT_DIR}/setup-instance-profile.sh"
# shellcheck source=infra/aws/setup-ec2/setup-instance.sh
. "${SCRIPT_DIR}/setup-instance.sh"

load_env_file "${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
configure_common_defaults

echo "Setting up EC2 stack for ${PROJECT_NAME} in ${AWS_REGION}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

setup_ecr_repositories
setup_key_pair
setup_instance_profile
setup_ec2_instance

ensure_output_dir
EC2_ENV_FILE="${OUTPUT_DIR}/ec2-resources.env"
EC2_REPORT_FILE="${OUTPUT_DIR}/ec2-report.txt"
write_env_output "$EC2_ENV_FILE" \
  AWS_REGION PROJECT_NAME ENVIRONMENT ACCOUNT_ID ADMIN_CIDR \
  WEB_ECR_REPOSITORY API_ECR_REPOSITORY WORKERS_ECR_REPOSITORY WEB_ECR_URI API_ECR_URI WORKERS_ECR_URI \
  EC2_ROLE_ARN EC2_RUNTIME_POLICY_ARN EC2_INSTANCE_PROFILE_NAME \
  SUBNET_ID SG_ID AMI_ID INSTANCE_ID ALLOC_ID ELASTIC_IP KEY_NAME SSH_PUBKEY_PATH INSTANCE_TYPE

{
  printf 'Dokumen AWS EC2 resources\n'
  printf 'Generated: %s\n\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf 'AWS_REGION=%s\n' "$AWS_REGION"
  printf 'PROJECT_NAME=%s\n' "$PROJECT_NAME"
  printf 'ACCOUNT_ID=%s\n\n' "$ACCOUNT_ID"
  printf 'ECR web repository: %s\n' "$WEB_ECR_URI"
  printf 'ECR api repository: %s\n' "$API_ECR_URI"
  printf 'ECR workers repository: %s\n\n' "$WORKERS_ECR_URI"
  printf 'EC2 instance: %s\n' "$INSTANCE_ID"
  printf 'Elastic IP: %s\n' "$ELASTIC_IP"
  printf 'Security group: %s\n' "$SG_ID"
  printf 'Instance profile: %s\n' "$EC2_INSTANCE_PROFILE_NAME"
  printf 'Runtime role: %s\n' "$EC2_ROLE_ARN"
  printf 'Avatar bucket expected at runtime: %s\n' "${AVATARS_S3_BUCKET_NAME:-}"
} > "$EC2_REPORT_FILE"

chmod 600 "$EC2_REPORT_FILE" 2>/dev/null || true
echo "EC2 stack complete."
echo "Resource output: $EC2_ENV_FILE"
echo "Report: $EC2_REPORT_FILE"
