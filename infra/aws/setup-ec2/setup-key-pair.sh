#!/usr/bin/env bash

setup_key_pair() {
  echo "Importing EC2 SSH key pair"
  aws_region ec2 import-key-pair \
    --key-name "$KEY_NAME" \
    --tag-specifications "$(default_ec2_tag_spec key-pair "$KEY_NAME")" \
    --public-key-material "fileb://${SSH_PUBKEY_PATH}" >/dev/null 2>&1 || true
}
