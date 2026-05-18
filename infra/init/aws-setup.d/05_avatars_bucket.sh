#!/usr/bin/env bash

setup_avatar_bucket() {
  echo ""
  echo ">>> Avatar bucket"
  require_setup_values "Avatar bucket" AVATARS_S3_BUCKET_NAME
  ensure_bucket "$AVATARS_S3_BUCKET_NAME"
}
