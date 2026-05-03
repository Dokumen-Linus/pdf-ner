#!/usr/bin/env bash

setup_ecr_and_runtime_role() {
  echo ""
  echo ">>> 6. ECR repositories and EC2 runtime IAM"

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
}
