#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/shared/load-env-file.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../shared/load-env-file.sh"
ENV_FILE_ARG="${1:-}"

load_env_file "${LOCAL_ENV_FILE:-${ENV_FILE_ARG:-${SCRIPT_DIR}/.env.local}}"

AWS_REGION="${AWS_REGION:-us-east-1}"
WEB_ECR_REPOSITORY="${WEB_ECR_REPOSITORY:-dokumen-web}"
API_ECR_REPOSITORY="${API_ECR_REPOSITORY:-dokumen-api}"
WORKERS_ECR_REPOSITORY="${WORKERS_ECR_REPOSITORY:-dokumen-workers}"
EC2_APP_DIR="${EC2_APP_DIR:-/opt/dokumen/pdf-ner}"
EC2_DEPLOY_STATE_DIR="${EC2_DEPLOY_STATE_DIR:-/opt/dokumen/deploy-state}"

required_vars=(
  AWS_GITHUB_DEPLOY_ROLE_ARN
  EC2_INSTANCE_ID
  VITE_BASE_URL
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "${var_name} is required."
    exit 1
  fi
done
echo "Required environment variables are present." >&2

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is required."
  exit 1
fi
echo "Required local commands are available: gh." >&2

gh secret set AWS_GITHUB_DEPLOY_ROLE_ARN --body "$AWS_GITHUB_DEPLOY_ROLE_ARN"
echo "Set secret AWS_GITHUB_DEPLOY_ROLE_ARN." >&2

gh secret set EC2_INSTANCE_ID --body "$EC2_INSTANCE_ID"
echo "Set secret EC2_INSTANCE_ID." >&2

gh variable set AWS_REGION --body "$AWS_REGION"
echo "Set variable AWS_REGION (${AWS_REGION})." >&2

gh variable set VITE_BASE_URL --body "$VITE_BASE_URL"
echo "Set variable VITE_BASE_URL." >&2

if [[ -n "${VITE_STRIPE_PUBLISHABLE_KEY:-}" ]]; then
  gh variable set VITE_STRIPE_PUBLISHABLE_KEY --body "$VITE_STRIPE_PUBLISHABLE_KEY"
  echo "Set variable VITE_STRIPE_PUBLISHABLE_KEY." >&2
else
  echo "VITE_STRIPE_PUBLISHABLE_KEY not set; skipping." >&2
fi

gh variable set API_ECR_REPOSITORY --body "$API_ECR_REPOSITORY"
echo "Set variable API_ECR_REPOSITORY (${API_ECR_REPOSITORY})." >&2

gh variable set WEB_ECR_REPOSITORY --body "$WEB_ECR_REPOSITORY"
echo "Set variable WEB_ECR_REPOSITORY (${WEB_ECR_REPOSITORY})." >&2

gh variable set WORKERS_ECR_REPOSITORY --body "$WORKERS_ECR_REPOSITORY"
echo "Set variable WORKERS_ECR_REPOSITORY (${WORKERS_ECR_REPOSITORY})." >&2

gh variable set EC2_APP_DIR --body "$EC2_APP_DIR"
echo "Set variable EC2_APP_DIR (${EC2_APP_DIR})." >&2

gh variable set EC2_DEPLOY_STATE_DIR --body "$EC2_DEPLOY_STATE_DIR"
echo "Set variable EC2_DEPLOY_STATE_DIR (${EC2_DEPLOY_STATE_DIR})." >&2

echo "All GitHub secrets and variables set." >&2
