#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/aws/shared/common.sh
. "${SCRIPT_DIR}/../shared/common.sh"
# shellcheck source=infra/aws/setup-ec2/setup-ecr.sh
. "${SCRIPT_DIR}/setup-ecr.sh"
# shellcheck source=infra/aws/setup-ec2/setup-gh-actions-role.sh
. "${SCRIPT_DIR}/setup-gh-actions-role.sh"
# shellcheck source=infra/aws/setup-ec2/setup-key-pair.sh
. "${SCRIPT_DIR}/setup-key-pair.sh"
# shellcheck source=infra/aws/setup-ec2/setup-instance-profile.sh
. "${SCRIPT_DIR}/setup-instance-profile.sh"
# shellcheck source=infra/aws/setup-ec2/setup-instance.sh
. "${SCRIPT_DIR}/setup-instance.sh"

load_env_file "${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
configure_common_defaults

DEPLOY_BRANCH="${DEPLOY_BRANCH:-}"
GITHUB_REPO="${GITHUB_REPO:-}"
GITHUB_ACTIONS_ROLE_NAME="${GITHUB_ACTIONS_ROLE_NAME:-${PROJECT_NAME}-github-deploy}"
GITHUB_ACTIONS_POLICY_NAME="${GITHUB_ACTIONS_POLICY_NAME:-${PROJECT_NAME}-github-deploy}"
GITHUB_OIDC_PROVIDER_NAME="${GITHUB_OIDC_PROVIDER_NAME:-${PROJECT_NAME}-github-oidc-provider}"
GITHUB_OIDC_PROVIDER_URL="${GITHUB_OIDC_PROVIDER_URL:-https://token.actions.githubusercontent.com}"

echo "Setting up EC2 stack for ${PROJECT_NAME} in ${AWS_REGION}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

setup_ecr_repositories
setup_key_pair
setup_instance_profile
setup_ec2_instance
setup_github_actions_role

EC2_ENV_FILE="${OUTPUT_DIR}/ec2-resources.env"
EC2_REPORT_FILE="${OUTPUT_DIR}/ec2-report.txt"
write_env_output "$EC2_ENV_FILE" \
  AWS_REGION PROJECT_NAME ENVIRONMENT ACCOUNT_ID ADMIN_CIDR \
  WEB_ECR_REPOSITORY API_ECR_REPOSITORY WORKERS_ECR_REPOSITORY WEB_ECR_URI API_ECR_URI WORKERS_ECR_URI \
  EC2_ROLE_ARN EC2_RUNTIME_POLICY_ARN EC2_INSTANCE_PROFILE_NAME GITHUB_OIDC_PROVIDER_ARN GITHUB_ACTIONS_ROLE_ARN GITHUB_ACTIONS_POLICY_ARN \
  SUBNET_ID SG_ID AMI_ID INSTANCE_ID ALLOC_ID ELASTIC_IP KEY_NAME SSH_PUBKEY_PATH INSTANCE_TYPE

cat > "$EC2_REPORT_FILE" <<EOF
Dokumen AWS EC2 resources
Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')

AWS_REGION=${AWS_REGION}
PROJECT_NAME=${PROJECT_NAME}
ACCOUNT_ID=${ACCOUNT_ID}

ECR web repository: ${WEB_ECR_URI}
ECR api repository: ${API_ECR_URI}
ECR workers repository: ${WORKERS_ECR_URI}

EC2 instance: ${INSTANCE_ID}
Elastic IP: ${ELASTIC_IP}
Security group: ${SG_ID}
Instance profile: ${EC2_INSTANCE_PROFILE_NAME}
Runtime role: ${EC2_ROLE_ARN}
GitHub OIDC provider: ${GITHUB_OIDC_PROVIDER_ARN}
GitHub Actions role: ${GITHUB_ACTIONS_ROLE_ARN}
GitHub Actions policy: ${GITHUB_ACTIONS_POLICY_ARN}
Avatar bucket expected at runtime: ${AVATARS_S3_BUCKET_NAME}
EOF

chmod 600 "$EC2_REPORT_FILE" 2>/dev/null || true
echo "EC2 stack complete."
echo "Resource output: $EC2_ENV_FILE"
echo "Report: $EC2_REPORT_FILE"
