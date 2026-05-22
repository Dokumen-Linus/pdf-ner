#!/usr/bin/env bash

setup_instance_profile() {
  local trust_policy runtime_policy_document

  echo "Setting up EC2 instance profile"
  trust_policy='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

  runtime_policy_document=$(cat <<EOF
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
        "s3:PutBucketPolicy",
        "s3:HeadBucket"
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

  EC2_ROLE_ARN="$(ensure_role "$EC2_ROLE_NAME" "$trust_policy")"
  EC2_RUNTIME_POLICY_ARN="$(ensure_policy "$EC2_RUNTIME_POLICY_NAME" "$runtime_policy_document")"
  aws iam attach-role-policy --role-name "$EC2_ROLE_NAME" --policy-arn "$EC2_RUNTIME_POLICY_ARN"
  aws iam attach-role-policy --role-name "$EC2_ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  ensure_instance_profile "$EC2_ROLE_NAME" "$EC2_INSTANCE_PROFILE_NAME"
  sleep 30
}
