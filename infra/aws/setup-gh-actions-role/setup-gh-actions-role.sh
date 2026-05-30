#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/aws/shared/common.sh
. "${SCRIPT_DIR}/../shared/common.sh"

load_env_file "${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
configure_common_defaults

DEPLOY_BRANCH="${DEPLOY_BRANCH:-}"
GITHUB_REPO="${GITHUB_REPO:-}"
GITHUB_ACTIONS_ROLE_NAME="${GITHUB_ACTIONS_ROLE_NAME:-${PROJECT_NAME}-github-deploy}"
GITHUB_ACTIONS_POLICY_NAME="${GITHUB_ACTIONS_POLICY_NAME:-${PROJECT_NAME}-github-deploy}"
GITHUB_OIDC_PROVIDER_NAME="${GITHUB_OIDC_PROVIDER_NAME:-${PROJECT_NAME}-github-oidc-provider}"
GITHUB_OIDC_PROVIDER_URL="${GITHUB_OIDC_PROVIDER_URL:-https://token.actions.githubusercontent.com}"
GITHUB_ACTIONS_POLICY_TEMPLATE="${GITHUB_ACTIONS_POLICY_TEMPLATE:-deploy-policy.json}"
EC2_INSTANCE_ID="${EC2_INSTANCE_ID:-${INSTANCE_ID:-}}"

render_policy_template() {
  local template_path="$1"

  jq \
    --arg aws_region "$AWS_REGION" \
    --arg account_id "$ACCOUNT_ID" \
    --arg ec2_instance_id "$EC2_INSTANCE_ID" \
    --arg web_ecr_repository "$WEB_ECR_REPOSITORY" \
    --arg api_ecr_repository "$API_ECR_REPOSITORY" \
    --arg workers_ecr_repository "$WORKERS_ECR_REPOSITORY" \
    '
      def replace_tokens:
        if type == "string" then
          gsub("\\$\\{AWS_REGION\\}"; $aws_region)
          | gsub("\\$\\{ACCOUNT_ID\\}"; $account_id)
          | gsub("\\$\\{EC2_INSTANCE_ID\\}"; $ec2_instance_id)
          | gsub("\\$\\{WEB_ECR_REPOSITORY\\}"; $web_ecr_repository)
          | gsub("\\$\\{API_ECR_REPOSITORY\\}"; $api_ecr_repository)
          | gsub("\\$\\{WORKERS_ECR_REPOSITORY\\}"; $workers_ecr_repository)
        elif type == "array" then
          map(replace_tokens)
        elif type == "object" then
          with_entries(.value |= replace_tokens)
        else
          .
        end;
      replace_tokens
    ' "$template_path"
}

echo "Setting up GitHub Actions deployment IAM for ${PROJECT_NAME} in ${AWS_REGION}"
: "${GITHUB_REPO:?Set GITHUB_REPO to owner/repo before running setup-gh-actions-role.sh}"
: "${DEPLOY_BRANCH:?Set DEPLOY_BRANCH before running setup-gh-actions-role.sh}"
: "${EC2_INSTANCE_ID:?Set EC2_INSTANCE_ID to the target EC2 instance before running setup-gh-actions-role.sh}"
: "${WEB_ECR_REPOSITORY:?Set WEB_ECR_REPOSITORY before running setup-gh-actions-role.sh}"
: "${API_ECR_REPOSITORY:?Set API_ECR_REPOSITORY before running setup-gh-actions-role.sh}"
: "${WORKERS_ECR_REPOSITORY:?Set WORKERS_ECR_REPOSITORY before running setup-gh-actions-role.sh}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
POLICY_TEMPLATE_PATH="${SCRIPT_DIR}/${GITHUB_ACTIONS_POLICY_TEMPLATE}"
if [ ! -f "$POLICY_TEMPLATE_PATH" ]; then
  echo "Policy template not found: $POLICY_TEMPLATE_PATH" >&2
  exit 1
fi

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

GITHUB_ACTIONS_POLICY_DOCUMENT="$(render_policy_template "$POLICY_TEMPLATE_PATH")"
GITHUB_ACTIONS_ROLE_ARN=$(ensure_role "$GITHUB_ACTIONS_ROLE_NAME" "$GITHUB_TRUST_POLICY")
GITHUB_ACTIONS_POLICY_ARN=$(ensure_policy "$GITHUB_ACTIONS_POLICY_NAME" "$GITHUB_ACTIONS_POLICY_DOCUMENT")
aws iam attach-role-policy --role-name "$GITHUB_ACTIONS_ROLE_NAME" --policy-arn "$GITHUB_ACTIONS_POLICY_ARN"

ensure_output_dir
GITHUB_ACTIONS_ENV_FILE="${OUTPUT_DIR}/github-actions-role.env"
GITHUB_ACTIONS_REPORT_FILE="${OUTPUT_DIR}/github-actions-role-report.txt"
write_env_output "$GITHUB_ACTIONS_ENV_FILE" \
  AWS_REGION PROJECT_NAME ENVIRONMENT ACCOUNT_ID \
  GITHUB_REPO DEPLOY_BRANCH EC2_INSTANCE_ID \
  WEB_ECR_REPOSITORY API_ECR_REPOSITORY WORKERS_ECR_REPOSITORY \
  GITHUB_OIDC_PROVIDER_ARN GITHUB_ACTIONS_ROLE_ARN GITHUB_ACTIONS_POLICY_ARN

{
  printf 'Dokumen GitHub Actions AWS deploy role\n'
  printf 'Generated: %s\n\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf 'AWS_REGION=%s\n' "$AWS_REGION"
  printf 'PROJECT_NAME=%s\n' "$PROJECT_NAME"
  printf 'ACCOUNT_ID=%s\n' "$ACCOUNT_ID"
  printf 'GitHub repo: %s\n' "$GITHUB_REPO"
  printf 'Deploy branch: %s\n' "$DEPLOY_BRANCH"
  printf 'EC2 instance: %s\n' "$EC2_INSTANCE_ID"
  printf 'GitHub OIDC provider: %s\n' "$GITHUB_OIDC_PROVIDER_ARN"
  printf 'GitHub Actions role: %s\n' "$GITHUB_ACTIONS_ROLE_ARN"
  printf 'GitHub Actions policy: %s\n' "$GITHUB_ACTIONS_POLICY_ARN"
} > "$GITHUB_ACTIONS_REPORT_FILE"

chmod 600 "$GITHUB_ACTIONS_REPORT_FILE" 2>/dev/null || true
echo "GitHub Actions deploy role complete."
echo "Resource output: $GITHUB_ACTIONS_ENV_FILE"
echo "Report: $GITHUB_ACTIONS_REPORT_FILE"
