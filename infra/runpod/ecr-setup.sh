#!/usr/bin/env bash

ensure_ecr_repository() {
  local repository_name="$1"
  local repository_arn lifecycle_policy tag_args
  tag_args=("Key=Name,Value=${repository_name}" "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=${ENVIRONMENT}")

  if aws_region ecr describe-repositories --repository-names "$repository_name" >/dev/null 2>&1; then
    echo "Reusing ECR repository: $repository_name"
  else
    aws_region ecr create-repository \
      --repository-name "$repository_name" \
      --image-scanning-configuration scanOnPush=true \
      --image-tag-mutability IMMUTABLE \
      --encryption-configuration encryptionType=AES256 \
      --tags "${tag_args[@]}" >/dev/null
    echo "Created ECR repository: $repository_name"
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
    --tags "${tag_args[@]}" >/dev/null
}

setup_ecr_repositories() {
  echo "Setting up app ECR repositories"
  ensure_ecr_repository "$DEEPSEEK_ECR_REPOSITORY"
  ensure_ecr_repository "$OLM_OCR2_ECR_REPOSITORY"

  DEEPSEEK_ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${DEEPSEEK_ECR_REPOSITORY}"
  OLM_OCR2_ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${OLM_OCR2_ECR_REPOSITORY}"
}
