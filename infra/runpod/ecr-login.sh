#!/usr/bin/env bash
# Log Docker in to AWS ECR and ensure the GPU OCR repositories exist.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
ECR_UNTAGGED_IMAGE_RETENTION_DAYS="${ECR_UNTAGGED_IMAGE_RETENTION_DAYS:-14}"

if [ -f "$LOCAL_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$LOCAL_ENV_FILE"
  set +a
fi

AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="${PROJECT_NAME:-dokumen}"
DEEPSEEK_ECR_REPOSITORY="${DEEPSEEK_ECR_REPOSITORY:-${PROJECT_NAME}-deepseek-ocr}"
OLM_OCR2_ECR_REPOSITORY="${OLM_OCR2_ECR_REPOSITORY:-${PROJECT_NAME}-olm-ocr2}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1" >&2
    exit 1
  fi
}

ecr_lifecycle_policy_json() {
  jq -cn --argjson days "$ECR_UNTAGGED_IMAGE_RETENTION_DAYS" '
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
    }'
}

aws_region() {
  aws --region "$AWS_REGION" "$@"
}

ensure_ecr_repository() {
  local repository="$1"
  if aws_region ecr describe-repositories --repository-names "$repository" >/dev/null 2>&1; then
    echo "Reusing ECR repository: $repository"
  else
    aws_region ecr create-repository \
      --repository-name "$repository" \
      --image-scanning-configuration scanOnPush=true \
      --image-tag-mutability IMMUTABLE \
      --encryption-configuration encryptionType=AES256 >/dev/null
    echo "Created ECR repository: $repository"
  fi

  aws_region ecr put-image-scanning-configuration \
    --repository-name "$repository" \
    --image-scanning-configuration scanOnPush=true >/dev/null
  aws_region ecr put-image-tag-mutability \
    --repository-name "$repository" \
    --image-tag-mutability IMMUTABLE >/dev/null
  aws_region ecr put-lifecycle-policy \
    --repository-name "$repository" \
    --lifecycle-policy-text "$(ecr_lifecycle_policy_json)" >/dev/null
}

require_cmd aws
require_cmd docker
require_cmd jq

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

ensure_ecr_repository "$DEEPSEEK_ECR_REPOSITORY"
ensure_ecr_repository "$OLM_OCR2_ECR_REPOSITORY"

aws_region ecr get-login-password | docker login --username AWS --password-stdin "$ECR_REGISTRY"

cat <<EOF
ECR login complete.
Registry: $ECR_REGISTRY
DeepSeek image repo: $ECR_REGISTRY/$DEEPSEEK_ECR_REPOSITORY
olmOCR2 image repo: $ECR_REGISTRY/$OLM_OCR2_ECR_REPOSITORY
EOF
