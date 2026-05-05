#!/usr/bin/env bash

deploy_to_ec2() {
  if [ "$DO_DEPLOY" != "1" ]; then
    return
  fi

  echo ""
  echo ">>> 10. EC2 deployment"
  require_cmd ssh
  require_cmd scp

  echo "    Waiting for SSH..."
  for _ in $(seq 1 30); do
    if remote_run "$ELASTIC_IP" "true" >/dev/null 2>&1; then
      break
    fi
    sleep 30
  done

  remote_run "$ELASTIC_IP" "sudo dnf update -y && sudo dnf install -y docker git awscli amazon-ssm-agent jq curl && sudo systemctl enable --now docker amazon-ssm-agent && sudo usermod -aG docker ec2-user && docker compose version"
  remote_run "$ELASTIC_IP" "sudo install -d -o ec2-user -g ec2-user '$REMOTE_APP_DIR'"
  remote_run "$ELASTIC_IP" "if [ -d '$REMOTE_APP_DIR/.git' ]; then cd '$REMOTE_APP_DIR' && git fetch origin && git checkout '$DEPLOY_BRANCH' && git pull --ff-only origin '$DEPLOY_BRANCH'; else git clone --branch '$DEPLOY_BRANCH' '$REPO_URL' '$REMOTE_APP_DIR'; fi"

  if [ "$UPLOAD_LOCAL_ENV" = "1" ] && [ -f "$PROD_ENV_FILE" ]; then
    scp -i "$SSH_PRIVATE_KEY_PATH" "$PROD_ENV_FILE" "ec2-user@${ELASTIC_IP}:${REMOTE_APP_DIR}/infra/.env.prod"
    echo "    Uploaded local infra/.env.prod"
  else
    echo "    No infra/.env.prod uploaded. Create ${REMOTE_APP_DIR}/infra/.env.prod before starting Compose."
  fi

  if [ "$START_COMPOSE" = "1" ]; then
    remote_run "$ELASTIC_IP" "cd '$REMOTE_APP_DIR' && docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build"
  else
    echo "    START_COMPOSE=0, skipped docker compose startup."
  fi
}
