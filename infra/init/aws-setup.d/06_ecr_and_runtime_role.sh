#!/usr/bin/env bash

setup_ecr_and_runtime_role() {
  echo ""
  echo ">>> ECR repositories and EC2 runtime IAM"
  require_setup_values "ECR and EC2 runtime IAM" ACCOUNT_ID INSTANCE_ID

  ensure_ecr_repository "$WEB_ECR_REPOSITORY"
  ensure_ecr_repository "$API_ECR_REPOSITORY"
  ensure_ecr_repository "$WORKERS_ECR_REPOSITORY"
  ensure_ecr_repository "$GPU_DEEPSEEK_ECR_REPOSITORY"
  ensure_ecr_repository "$GPU_OLM_OCR2_ECR_REPOSITORY"

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
        "arn:aws:ecr:${AWS_REGION}:${ACCOUNT_ID}:repository/$(json_escape "$WORKERS_ECR_REPOSITORY")",
        "arn:aws:ecr:${AWS_REGION}:${ACCOUNT_ID}:repository/$(json_escape "$GPU_DEEPSEEK_ECR_REPOSITORY")",
        "arn:aws:ecr:${AWS_REGION}:${ACCOUNT_ID}:repository/$(json_escape "$GPU_OLM_OCR2_ECR_REPOSITORY")"
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
    },
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:GetBucketLocation",
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListBucketMultipartUploads",
        "s3:ListMultipartUploadParts",
        "s3:PutLifecycleConfiguration",
        "s3:GetLifecycleConfiguration",
        "s3:PutBucketPublicAccessBlock",
        "s3:PutEncryptionConfiguration",
        "s3:PutBucketVersioning",
        "s3:GetBucketPolicy",
        "s3:PutBucketPolicy"
      ],
      "Resource": [
        "arn:aws:s3:::*",
        "arn:aws:s3:::*/*"
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
