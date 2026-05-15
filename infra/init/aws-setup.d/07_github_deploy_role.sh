#!/usr/bin/env bash

setup_github_deploy_role() {
  echo ""
  echo ">>> 7. GitHub deployment IAM"

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
        "arn:aws:ecr:${AWS_REGION}:${ACCOUNT_ID}:repository/$(json_escape "$WORKERS_ECR_REPOSITORY")",
        "arn:aws:ecr:${AWS_REGION}:${ACCOUNT_ID}:repository/$(json_escape "$GPU_DEEPSEEK_ECR_REPOSITORY")",
        "arn:aws:ecr:${AWS_REGION}:${ACCOUNT_ID}:repository/$(json_escape "$GPU_OLM_OCR2_ECR_REPOSITORY")"
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
}
