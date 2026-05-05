#!/usr/bin/env bash

setup_avatar_bucket() {
  echo ""
  echo ">>> 5. Avatar bucket"
  ensure_bucket "$AVATARS_S3_BUCKET_NAME"
}
