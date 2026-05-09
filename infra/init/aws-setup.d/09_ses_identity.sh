#!/usr/bin/env bash

setup_ses_identity() {
  echo ""
  echo ">>> 8. Secret drafts and SES identity"
  ensure_secret_drafts
  set_secret_draft_value prod-email.json SES_AWS_REGION "$AWS_REGION"
  set_secret_draft_value prod-api.json AVATARS_S3_BUCKET_NAME "$AVATARS_S3_BUCKET_NAME"
  set_secret_draft_value prod-api.json AVATARS_AWS_REGION "$AWS_REGION"
  set_secret_draft_value prod-web.json PDF_STORAGE_AWS_REGION "$AWS_REGION"

  aws_region ses verify-email-identity --email-address "$SES_IDENTITY_EMAIL" >/dev/null 2>&1 || true
  echo "    Local secret drafts: $SECRET_DRAFT_DIR"
  echo "    Review and complete these files before running infra/init/create-secrets.sh"
  echo "    Verification email requested for: $SES_IDENTITY_EMAIL"
  echo "    SES can send production email only after identity verification and sandbox exit."
}
