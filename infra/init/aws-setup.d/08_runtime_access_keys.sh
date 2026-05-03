#!/usr/bin/env bash

setup_runtime_access_keys() {
  echo ""
  echo ">>> 8. Runtime IAM credentials and local secret drafts"

  ensure_secret_drafts

  SES_POLICY_DOCUMENT=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    }
  ]
}
EOF
)

  AVATARS_POLICY_DOCUMENT=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": [
        "arn:aws:s3:::$(json_escape "$AVATARS_S3_BUCKET_NAME")",
        "arn:aws:s3:::$(json_escape "$AVATARS_S3_BUCKET_NAME")/*"
      ]
    }
  ]
}
EOF
)

  PDF_STORAGE_POLICY_DOCUMENT=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:HeadBucket",
        "s3:GetBucketLocation",
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:PutLifecycleConfiguration",
        "s3:GetLifecycleConfiguration",
        "s3:PutBucketPublicAccessBlock",
        "s3:PutBucketEncryption"
      ],
      "Resource": ["arn:aws:s3:::*", "arn:aws:s3:::*/*"]
    }
  ]
}
EOF
)

  SES_POLICY_ARN=$(ensure_policy "$SES_POLICY_NAME" "$SES_POLICY_DOCUMENT")
  AVATARS_POLICY_ARN=$(ensure_policy "$AVATARS_POLICY_NAME" "$AVATARS_POLICY_DOCUMENT")
  PDF_STORAGE_POLICY_ARN=$(ensure_policy "$PDF_STORAGE_POLICY_NAME" "$PDF_STORAGE_POLICY_DOCUMENT")

  aws iam create-user --user-name "$SES_IAM_USER_NAME" >/dev/null 2>&1 || true
  aws iam create-user --user-name "$AVATARS_IAM_USER_NAME" >/dev/null 2>&1 || true
  aws iam create-user --user-name "$PDF_STORAGE_IAM_USER_NAME" >/dev/null 2>&1 || true
  aws iam attach-user-policy --user-name "$SES_IAM_USER_NAME" --policy-arn "$SES_POLICY_ARN"
  aws iam attach-user-policy --user-name "$AVATARS_IAM_USER_NAME" --policy-arn "$AVATARS_POLICY_ARN"
  aws iam attach-user-policy --user-name "$PDF_STORAGE_IAM_USER_NAME" --policy-arn "$PDF_STORAGE_POLICY_ARN"

  if create_access_key "$SES_IAM_USER_NAME" "SES"; then
    set_secret_draft_value prod-email.json SES_AWS_ACCESS_KEY_ID "$ACCESS_KEY_ID"
    set_secret_draft_value prod-email.json SES_AWS_SECRET_ACCESS_KEY "$SECRET_ACCESS_KEY"
  fi
  set_secret_draft_value prod-email.json SES_AWS_REGION "$AWS_REGION"

  if create_access_key "$AVATARS_IAM_USER_NAME" "AVATARS"; then
    set_secret_draft_value prod-api.json AVATARS_AWS_ACCESS_KEY_ID "$ACCESS_KEY_ID"
    set_secret_draft_value prod-api.json AVATARS_AWS_SECRET_ACCESS_KEY "$SECRET_ACCESS_KEY"
  fi
  set_secret_draft_value prod-api.json AVATARS_S3_BUCKET_NAME "$AVATARS_S3_BUCKET_NAME"
  set_secret_draft_value prod-api.json AVATARS_AWS_REGION "$AWS_REGION"

  if create_access_key "$PDF_STORAGE_IAM_USER_NAME" "PDF_STORAGE"; then
    set_secret_draft_value prod-web.json PDF_STORAGE_AWS_ACCESS_KEY_ID "$ACCESS_KEY_ID"
    set_secret_draft_value prod-web.json PDF_STORAGE_AWS_SECRET_ACCESS_KEY "$SECRET_ACCESS_KEY"
  fi
  set_secret_draft_value prod-web.json PDF_STORAGE_AWS_REGION "$AWS_REGION"

  echo "    Local secret drafts: $SECRET_DRAFT_DIR"
  echo "    Review and complete these files before running infra/init/create-secrets.sh"
}
