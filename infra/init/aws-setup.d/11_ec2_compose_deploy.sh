#!/usr/bin/env bash

ec2_deploy_remote_run() {
  local label="$1"
  local elastic_ip="$2"
  local status
  shift 2

  if remote_run "$elastic_ip" "$@"; then
    return 0
  else
    status=$?
  fi

  if [ "$status" = "255" ]; then
    echo "ERROR: SSH connection failed during EC2 deployment step: $label" >&2
    echo "       Target: ec2-user@$elastic_ip" >&2
    echo "       This usually means the connection was lost, the instance rebooted, SSH was restarted, or the network timed out." >&2
    echo "       Retry with: SETUP_ONLY=ec2-deployment bash infra/init/aws-setup.sh" >&2
  else
    echo "ERROR: EC2 remote command failed during deployment step: $label (exit $status)" >&2
  fi

  return "$status"
}

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
  require_boolean_env CLEAR_DOCKER_BUILD_CACHE
  require_boolean_env DEPLOY_CLEAN_CHECKOUT
  require_cmd ssh
  require_cmd scp

  echo "    SSH target: ec2-user@$ELASTIC_IP"
  echo "    SSH key: $SSH_PRIVATE_KEY_PATH"
  echo "    Remote app dir: $REMOTE_APP_DIR"
  echo "    Repo: $REPO_URL"
  echo "    Branch: $DEPLOY_BRANCH"
  echo "    Upload env: $UPLOAD_LOCAL_ENV"
  echo "    Start Compose: $START_COMPOSE"
  echo "    Compose services: ${COMPOSE_SERVICES:-all}"
  echo "    Clean checkout: $DEPLOY_CLEAN_CHECKOUT"
  echo "    Clear Docker build cache: $CLEAR_DOCKER_BUILD_CACHE"
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
  # shellcheck disable=SC2016
  ec2_deploy_remote_run "install host packages and enable services" "$ELASTIC_IP" 'set -euo pipefail
    sudo dnf update -y
    sudo dnf install -y docker git awscli amazon-ssm-agent jq openssh-clients
    command -v curl >/dev/null
    sudo systemctl enable --now docker amazon-ssm-agent
    sudo usermod -aG docker ec2-user

    arch="$(uname -m)"
    case "$arch" in
      x86_64)
        compose_arch=x86_64
        buildx_arch=amd64
        ;;
      aarch64|arm64)
        compose_arch=aarch64
        buildx_arch=arm64
        ;;
      *) echo "ERROR: unsupported Docker plugin architecture: $arch" >&2; exit 1 ;;
    esac
    sudo mkdir -p /usr/local/lib/docker/cli-plugins

    if ! docker compose version >/dev/null 2>&1; then
      sudo dnf install -y docker-compose-plugin || true
    fi
    if ! docker compose version >/dev/null 2>&1; then
      compose_version="$(curl -fsSL https://api.github.com/repos/docker/compose/releases/latest | jq -r .tag_name)"
      if [ -z "$compose_version" ] || [ "$compose_version" = "null" ]; then
        echo "ERROR: unable to resolve latest Docker Compose version." >&2
        exit 1
      fi
      sudo curl -fsSL \
        "https://github.com/docker/compose/releases/download/${compose_version}/docker-compose-linux-${compose_arch}" \
        -o /usr/local/lib/docker/cli-plugins/docker-compose
      sudo chmod 0755 /usr/local/lib/docker/cli-plugins/docker-compose
    fi

    buildx_current=""
    if docker buildx version >/dev/null 2>&1; then
      buildx_current="$(docker buildx version | awk '"'"'{print $2}'"'"' | sed "s/^v//")"
    else
      sudo dnf install -y docker-buildx-plugin || true
      if docker buildx version >/dev/null 2>&1; then
        buildx_current="$(docker buildx version | awk '"'"'{print $2}'"'"' | sed "s/^v//")"
      fi
    fi
    if [ -z "$buildx_current" ] || ! printf "0.17.0\n%s\n" "$buildx_current" | sort -VC; then
      buildx_version="$(curl -fsSL https://api.github.com/repos/docker/buildx/releases/latest | jq -r .tag_name)"
      if [ -z "$buildx_version" ] || [ "$buildx_version" = "null" ]; then
        echo "ERROR: unable to resolve latest Docker Buildx version." >&2
        exit 1
      fi
      sudo curl -fsSL \
        "https://github.com/docker/buildx/releases/download/${buildx_version}/buildx-${buildx_version}.linux-${buildx_arch}" \
        -o /usr/local/lib/docker/cli-plugins/docker-buildx
      sudo chmod 0755 /usr/local/lib/docker/cli-plugins/docker-buildx
    fi

    docker compose version
    docker buildx version
    docker buildx inspect >/dev/null 2>&1 || docker buildx create --use --name dokumen-builder >/dev/null'

  local ec2_repo_url git_ssh_command remote_deploy_key_path
  local git_ssh_command_q remote_app_dir_q deploy_branch_q ec2_repo_url_q
  local deploy_clean_checkout_q clear_docker_build_cache_q
  ec2_repo_url="$REPO_URL"
  git_ssh_command=""
  remote_deploy_key_path="/home/ec2-user/.ssh/github-deploy-key"

  if [ -n "${GITHUB_DEPLOY_KEY_PATH:-}" ]; then
    if [ ! -f "$GITHUB_DEPLOY_KEY_PATH" ]; then
      echo "ERROR: GITHUB_DEPLOY_KEY_PATH is set but the private key was not found: $GITHUB_DEPLOY_KEY_PATH" >&2
      return 1
    fi
    if [[ "$ec2_repo_url" == https://github.com/* ]]; then
      ec2_repo_url="git@github.com:${ec2_repo_url#https://github.com/}"
    fi

    echo "    Installing GitHub deploy key on EC2..."
    ec2_deploy_remote_run "install GitHub known_hosts entry" "$ELASTIC_IP" "install -d -m 700 /home/ec2-user/.ssh && ssh-keyscan github.com >> /home/ec2-user/.ssh/known_hosts && chmod 600 /home/ec2-user/.ssh/known_hosts"
    scp \
      -o StrictHostKeyChecking=accept-new \
      -o ConnectTimeout="$SSH_CONNECT_TIMEOUT" \
      -i "$SSH_PRIVATE_KEY_PATH" \
      "$GITHUB_DEPLOY_KEY_PATH" \
      "ec2-user@${ELASTIC_IP}:${remote_deploy_key_path}.tmp"
    ec2_deploy_remote_run "finalize GitHub deploy key" "$ELASTIC_IP" "mv '${remote_deploy_key_path}.tmp' '$remote_deploy_key_path' && chmod 600 '$remote_deploy_key_path'"
    git_ssh_command="ssh -i $remote_deploy_key_path -o IdentitiesOnly=yes"
  fi

  echo "    Ensuring remote app directory exists..."
  ec2_deploy_remote_run "ensure remote app directory" "$ELASTIC_IP" "sudo install -d -o ec2-user -g ec2-user '$REMOTE_APP_DIR'"

  echo "    Cloning or updating repo on EC2..."
  printf -v git_ssh_command_q '%q' "$git_ssh_command"
  printf -v remote_app_dir_q '%q' "$REMOTE_APP_DIR"
  printf -v deploy_branch_q '%q' "$DEPLOY_BRANCH"
  printf -v ec2_repo_url_q '%q' "$ec2_repo_url"
  printf -v deploy_clean_checkout_q '%q' "$DEPLOY_CLEAN_CHECKOUT"
  printf -v clear_docker_build_cache_q '%q' "$CLEAR_DOCKER_BUILD_CACHE"
  ec2_deploy_remote_run "clone or update repository" "$ELASTIC_IP" "set -euo pipefail
    GIT_SSH_COMMAND_VALUE=$git_ssh_command_q
    DEPLOY_CLEAN_CHECKOUT_VALUE=$deploy_clean_checkout_q
    run_git() {
      if [ -n \"\$GIT_SSH_COMMAND_VALUE\" ]; then
        GIT_SSH_COMMAND=\"\$GIT_SSH_COMMAND_VALUE\" \"\$@\"
      else
        \"\$@\"
      fi
    }
    if [ -d ${remote_app_dir_q}/.git ]; then
      cd $remote_app_dir_q
      run_git git fetch origin
      git checkout $deploy_branch_q
      run_git git reset --hard origin/$deploy_branch_q
      if [ \"\$DEPLOY_CLEAN_CHECKOUT_VALUE\" = \"1\" ]; then
        echo \"Cleaning stale checkout artifacts while preserving runtime bind mounts...\"
        git clean -ffdx -e infra/.env.prod -e infra/data/ -e infra/letsencrypt/
      fi
    else
      if [ -e $remote_app_dir_q ]; then
        echo \"Removing stale non-git remote app directory: $REMOTE_APP_DIR\"
        rm -rf $remote_app_dir_q
      fi
      run_git git clone --branch $deploy_branch_q $ec2_repo_url_q $remote_app_dir_q
    fi"

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
    local compose_services_q
    printf -v compose_services_q '%q' "$COMPOSE_SERVICES"
    echo "    Starting Docker Compose stack..."
    ec2_deploy_remote_run "start Docker Compose stack" "$ELASTIC_IP" "set -euo pipefail
      cd '$REMOTE_APP_DIR'
      export COMPOSE_PARALLEL_LIMIT=1
      CLEAR_DOCKER_BUILD_CACHE_VALUE=$clear_docker_build_cache_q
      if [ \"\$CLEAR_DOCKER_BUILD_CACHE_VALUE\" = \"1\" ]; then
        echo \"Pruning stopped containers, unused images, and Docker build cache before build...\"
        docker container prune -f || true
        docker image prune -af || true
        docker builder prune -af || true
        docker buildx prune -af || true
      fi
      COMPOSE_SERVICES_VALUE=$compose_services_q
      if [ -n \"\$COMPOSE_SERVICES_VALUE\" ]; then
        # shellcheck disable=SC2086
        docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build \$COMPOSE_SERVICES_VALUE
      else
        docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build
      fi
      if [ \"\$CLEAR_DOCKER_BUILD_CACHE_VALUE\" = \"1\" ]; then
        echo \"Pruning old images and Docker build cache after successful deploy...\"
        docker image prune -af || true
        docker builder prune -af || true
        docker buildx prune -af || true
      fi"
    echo "    Compose services:"
    ec2_deploy_remote_run "show Docker Compose services" "$ELASTIC_IP" "cd '$REMOTE_APP_DIR' && docker compose -f infra/docker-compose.yml --env-file infra/.env.prod ps"
  else
    echo "    START_COMPOSE=0, skipped docker compose startup."
  fi
}
