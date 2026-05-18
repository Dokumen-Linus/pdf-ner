#!/usr/bin/env bash

deploy_to_ec2() {
  if [ "$DO_DEPLOY" != "1" ]; then
    echo ""
  echo ">>> EC2 deployment"
    echo "    DO_DEPLOY=$DO_DEPLOY, skipped EC2 deployment."
    return
  fi

  echo ""
  echo ">>> 12. EC2 deployment"
  require_setup_values "EC2 deployment" ELASTIC_IP MY_IP
  require_cmd ssh
  require_cmd scp

  echo "    SSH target: ec2-user@$ELASTIC_IP"
  echo "    SSH key: $SSH_PRIVATE_KEY_PATH"
  echo "    Remote app dir: $REMOTE_APP_DIR"
  echo "    Repo: $REPO_URL"
  echo "    Branch: $DEPLOY_BRANCH"
  echo "    Upload env: $UPLOAD_LOCAL_ENV"
  echo "    Start Compose: $START_COMPOSE"
  echo "    Waiting for SSH (${SSH_WAIT_ATTEMPTS} attempts, ${SSH_WAIT_SECONDS}s apart)..."

  local attempt last_ssh_error
  last_ssh_error=""
  for attempt in $(seq 1 "$SSH_WAIT_ATTEMPTS"); do
    if last_ssh_error="$(remote_probe "$ELASTIC_IP" 2>&1 >/dev/null)"; then
      echo "    SSH is ready on attempt $attempt."
      break
    fi

    echo "    SSH attempt $attempt/$SSH_WAIT_ATTEMPTS failed: ${last_ssh_error:-no output}"
    if [ "$attempt" = "$SSH_WAIT_ATTEMPTS" ]; then
      echo "ERROR: SSH did not become ready for ec2-user@$ELASTIC_IP." >&2
      echo "Last SSH error: ${last_ssh_error:-no output}" >&2
      echo "Check that the EC2 instance is running, port 22 allows $MY_IP, and the key is loaded or unencrypted:" >&2
      echo "  ssh -i \"$SSH_PRIVATE_KEY_PATH\" ec2-user@$ELASTIC_IP" >&2
      return 1
    fi

    sleep "$SSH_WAIT_SECONDS"
  done

  echo "    Installing EC2 host packages and enabling services..."
  remote_run "$ELASTIC_IP" "sudo dnf update -y && sudo dnf install -y docker git awscli amazon-ssm-agent jq curl && sudo systemctl enable --now docker amazon-ssm-agent && sudo usermod -aG docker ec2-user && docker compose version"

  echo "    Ensuring remote app directory exists..."
  remote_run "$ELASTIC_IP" "sudo install -d -o ec2-user -g ec2-user '$REMOTE_APP_DIR'"

  echo "    Cloning or updating repo on EC2..."
  remote_run "$ELASTIC_IP" "if [ -d '$REMOTE_APP_DIR/.git' ]; then cd '$REMOTE_APP_DIR' && git fetch origin && git checkout '$DEPLOY_BRANCH' && git pull --ff-only origin '$DEPLOY_BRANCH'; else git clone --branch '$DEPLOY_BRANCH' '$REPO_URL' '$REMOTE_APP_DIR'; fi"

  if [ "$UPLOAD_LOCAL_ENV" = "1" ] && [ -f "$PROD_ENV_FILE" ]; then
    echo "    Uploading infra/.env.prod to EC2..."
    scp \
      -o StrictHostKeyChecking=accept-new \
      -o ConnectTimeout="$SSH_CONNECT_TIMEOUT" \
      -i "$SSH_PRIVATE_KEY_PATH" \
      "$PROD_ENV_FILE" \
      "ec2-user@${ELASTIC_IP}:${REMOTE_APP_DIR}/infra/.env.prod"
    echo "    Uploaded local infra/.env.prod"
  else
    echo "    No infra/.env.prod uploaded. Create ${REMOTE_APP_DIR}/infra/.env.prod before starting Compose."
  fi

  if [ "$START_COMPOSE" = "1" ]; then
    echo "    Starting Docker Compose stack..."
    remote_run "$ELASTIC_IP" "cd '$REMOTE_APP_DIR' && docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build"
    echo "    Compose services:"
    remote_run "$ELASTIC_IP" "cd '$REMOTE_APP_DIR' && docker compose -f infra/docker-compose.yml --env-file infra/.env.prod ps"
  else
    echo "    START_COMPOSE=0, skipped docker compose startup."
  fi
}
