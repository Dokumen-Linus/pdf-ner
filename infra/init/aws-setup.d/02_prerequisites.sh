#!/usr/bin/env bash

print_banner() {
  echo "============================================="
  echo "  Dokumen AI - AWS setup"
  echo "============================================="
  echo "Project:       $PROJECT_NAME"
  echo "Region:        $AWS_REGION"
  echo "Instance type: $INSTANCE_TYPE"
  echo "Domain:        $DOMAIN"
  echo "Repo:          $REPO_URL"
  echo "Deploy:        $DO_DEPLOY"
  echo "Secret drafts: $SECRET_DRAFT_DIR"
  echo "State file:    $SETUP_STATE_FILE"
  echo "State report:  $SETUP_REPORT_FILE"
  echo "Resume:        $SETUP_RESUME"
  echo "Start at:      ${SETUP_START_AT:-<first>}"
  echo "Stop after:    ${SETUP_STOP_AFTER:-<last>}"
  echo "Only:          ${SETUP_ONLY:-<none>}"
  echo "============================================="
  echo ""
}

check_prerequisites() {
  require_cmd aws
  require_cmd curl
  require_cmd jq
  require_env DEPLOY_BRANCH
  require_env GITHUB_REPO

  if [ "$EC2_SSH_ENABLED" = "1" ] && [ ! -f "$SSH_PUBKEY_PATH" ]; then
    echo "ERROR: SSH public key not found: $SSH_PUBKEY_PATH" >&2
    echo "Generate one with: ssh-keygen -t ed25519 -f ${SSH_PRIVATE_KEY_PATH}" >&2
    return 1
  fi

  refresh_current_admin_ip
  ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
  AVATARS_S3_BUCKET_NAME="${AVATARS_S3_BUCKET_NAME:-${PROJECT_NAME}-avatars-${ACCOUNT_ID}-${AWS_REGION}}"

  echo "AWS account:   $ACCOUNT_ID"
  echo "GitHub repo:   $GITHUB_REPO"
  echo "Deploy branch: $DEPLOY_BRANCH"
  echo "SSH allowed:   $MY_IP"
  echo "SSH enabled:   $EC2_SSH_ENABLED"
  echo "Avatar bucket: $AVATARS_S3_BUCKET_NAME"
  echo "Prod RDS:      $CREATE_PROD_RDS ($PROD_RDS_IDENTIFIER)"
  echo "Dev RDS:       $CREATE_DEV_RDS ($DEV_RDS_IDENTIFIER)"
  echo "RDS IP refresh: $REFRESH_RDS_ADMIN_IP"
  echo "EC2 deploy:    $DO_DEPLOY"
  echo "State file:    $SETUP_STATE_FILE"
  echo "State report:  $SETUP_REPORT_FILE"
  echo ""
}
