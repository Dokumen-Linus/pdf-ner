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
  echo "============================================="
  echo ""
}

check_prerequisites() {
  require_cmd aws
  require_cmd curl
  require_cmd jq
  require_env DEPLOY_BRANCH
  require_env GITHUB_REPO

  if [ ! -f "$SSH_PUBKEY_PATH" ]; then
    echo "ERROR: SSH public key not found: $SSH_PUBKEY_PATH" >&2
    echo "Generate one with: ssh-keygen -t ed25519 -f ${SSH_PRIVATE_KEY_PATH}" >&2
    exit 1
  fi

  MY_IP="$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')/32"
  ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
  AVATARS_S3_BUCKET_NAME="${AVATARS_S3_BUCKET_NAME:-${PROJECT_NAME}-avatars-${ACCOUNT_ID}-${AWS_REGION}}"

  echo "AWS account:   $ACCOUNT_ID"
  echo "SSH allowed:   $MY_IP"
  echo "Avatar bucket: $AVATARS_S3_BUCKET_NAME"
  echo ""
}
