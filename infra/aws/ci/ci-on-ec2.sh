#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/deploy-aws/shared/common.sh
. "${SCRIPT_DIR}/../shared/common.sh"

load_env_file "${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
configure_common_defaults

declare ELASTIC_IP
declare REPO_URL
declare DEPLOY_BRANCH
declare REMOTE_APP_DIR
declare SSH_PRIVATE_KEY_PATH
declare SSH_CONNECT_TIMEOUT
declare SSH_SERVER_ALIVE_INTERVAL
declare SSH_SERVER_ALIVE_COUNT_MAX
declare SSH_WAIT_ATTEMPTS
declare SSH_WAIT_SECONDS

: "${ELASTIC_IP}"
: "${REPO_URL}"
: "${DEPLOY_BRANCH}"
: "${REMOTE_APP_DIR}"
: "${SSH_PRIVATE_KEY_PATH}"
: "${SSH_CONNECT_TIMEOUT}"
: "${SSH_SERVER_ALIVE_INTERVAL}"
: "${SSH_SERVER_ALIVE_COUNT_MAX}"
: "${SSH_WAIT_ATTEMPTS}"
: "${SSH_WAIT_SECONDS}"

ec2_ci_remote_run() {
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
    echo "ERROR: SSH connection failed during EC2 CI step: $label" >&2
    echo "Target: ec2-user@$elastic_ip" >&2
  else
    echo "ERROR: EC2 remote command failed during CI step: $label (exit $status)" >&2
  fi

  return "$status"
}

echo "Preparing EC2 checkout for ${PROJECT_NAME} in ${AWS_REGION}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

echo "SSH target: ec2-user@${ELASTIC_IP}"
echo "Remote app dir: ${REMOTE_APP_DIR}"
echo "Repo: ${REPO_URL}"
echo "Branch: ${DEPLOY_BRANCH}"
echo "Waiting for SSH..."

last_ssh_error=""
for attempt in $(seq 1 "$SSH_WAIT_ATTEMPTS"); do
  if last_ssh_error="$(remote_probe "$ELASTIC_IP" 2>&1 >/dev/null)"; then
    echo "SSH is ready on attempt ${attempt}."
    break
  fi

  echo "SSH attempt ${attempt}/${SSH_WAIT_ATTEMPTS} failed: ${last_ssh_error:-no output}"
  if [ "$attempt" = "$SSH_WAIT_ATTEMPTS" ]; then
    echo "ERROR: SSH did not become ready for ec2-user@${ELASTIC_IP}." >&2
    echo "Last SSH error: ${last_ssh_error:-no output}" >&2
    exit 1
  fi
  sleep "$SSH_WAIT_SECONDS"
done

echo "Installing EC2 host packages and enabling services..."
remote_install_script=$(cat <<'REMOTE_INSTALL'
set -euo pipefail
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
    sudo curl -fsSL \
      "https://github.com/docker/compose/releases/download/${compose_version}/docker-compose-linux-${compose_arch}" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    sudo chmod 0755 /usr/local/lib/docker/cli-plugins/docker-compose
  fi

  buildx_current=""
  if docker buildx version >/dev/null 2>&1; then
    buildx_current="$(docker buildx version | awk '{print $2}' | sed "s/^v//")"
  else
    sudo dnf install -y docker-buildx-plugin || true
    if docker buildx version >/dev/null 2>&1; then
      buildx_current="$(docker buildx version | awk '{print $2}' | sed "s/^v//")"
    fi
  fi
  if [ -z "$buildx_current" ] || ! printf "0.17.0\n%s\n" "$buildx_current" | sort -VC; then
    buildx_version="$(curl -fsSL https://api.github.com/repos/docker/buildx/releases/latest | jq -r .tag_name)"
    sudo curl -fsSL \
      "https://github.com/docker/buildx/releases/download/${buildx_version}/buildx-${buildx_version}.linux-${buildx_arch}" \
      -o /usr/local/lib/docker/cli-plugins/docker-buildx
    sudo chmod 0755 /usr/local/lib/docker/cli-plugins/docker-buildx
  fi

  docker compose version
  docker buildx version
  docker buildx inspect >/dev/null 2>&1 || docker buildx create --use --name dokumen-builder >/dev/null
REMOTE_INSTALL
)
ec2_ci_remote_run "install host packages and enable services" "$ELASTIC_IP" "$remote_install_script"

ec2_repo_url="$REPO_URL"
git_ssh_command=""
remote_deploy_key_path="/home/ec2-user/.ssh/github-deploy-key"

if [ -n "${GITHUB_DEPLOY_KEY_PATH:-}" ]; then
  if [ ! -f "$GITHUB_DEPLOY_KEY_PATH" ]; then
    echo "ERROR: GITHUB_DEPLOY_KEY_PATH is set but the private key was not found: $GITHUB_DEPLOY_KEY_PATH" >&2
    exit 1
  fi
  if [[ "$ec2_repo_url" == https://github.com/* ]]; then
    ec2_repo_url="git@github.com:${ec2_repo_url#https://github.com/}"
  fi
  echo "Installing repository deploy key on EC2..."
  ec2_ci_remote_run "install repository known_hosts entry" "$ELASTIC_IP" "install -d -m 700 /home/ec2-user/.ssh && ssh-keyscan github.com >> /home/ec2-user/.ssh/known_hosts && chmod 600 /home/ec2-user/.ssh/known_hosts"
  scp \
    -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout="$SSH_CONNECT_TIMEOUT" \
    -i "$SSH_PRIVATE_KEY_PATH" \
    "$GITHUB_DEPLOY_KEY_PATH" \
    "ec2-user@${ELASTIC_IP}:${remote_deploy_key_path}.tmp"
  ec2_ci_remote_run "finalize repository deploy key" "$ELASTIC_IP" "mv '${remote_deploy_key_path}.tmp' '$remote_deploy_key_path' && chmod 600 '$remote_deploy_key_path'"
  git_ssh_command="ssh -i $remote_deploy_key_path -o IdentitiesOnly=yes"
fi

printf -v git_ssh_command_q '%q' "$git_ssh_command"
printf -v remote_app_dir_q '%q' "$REMOTE_APP_DIR"
printf -v deploy_branch_q '%q' "$DEPLOY_BRANCH"
printf -v ec2_repo_url_q '%q' "$ec2_repo_url"

echo "Ensuring remote app directory exists..."
ec2_ci_remote_run "ensure remote app directory" "$ELASTIC_IP" "sudo install -d -o ec2-user -g ec2-user '$REMOTE_APP_DIR'"

echo "Cloning or updating repo on EC2..."
ec2_ci_remote_run "clone or update repository" "$ELASTIC_IP" "set -euo pipefail
  GIT_SSH_COMMAND_VALUE=$git_ssh_command_q
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
    git clean -ffdx -e infra/.env.prod -e infra/data/ -e infra/letsencrypt/
  else
    if [ -e $remote_app_dir_q ]; then
      rm -rf $remote_app_dir_q
    fi
    run_git git clone --branch $deploy_branch_q $ec2_repo_url_q $remote_app_dir_q
  fi"

CI_REPORT_FILE="${OUTPUT_DIR}/ci-on-ec2-report.txt"
ensure_output_dir
cat > "$CI_REPORT_FILE" <<EOF
Dokumen EC2 CI checkout
Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')

AWS_REGION=${AWS_REGION}
PROJECT_NAME=${PROJECT_NAME}
ACCOUNT_ID=${ACCOUNT_ID}
ELASTIC_IP=${ELASTIC_IP}
REMOTE_APP_DIR=${REMOTE_APP_DIR}
REPO_URL=${REPO_URL}
DEPLOY_BRANCH=${DEPLOY_BRANCH}
GITHUB_DEPLOY_KEY_PATH_SET=$([ -n "${GITHUB_DEPLOY_KEY_PATH:-}" ] && echo 1 || echo 0)
EOF
chmod 600 "$CI_REPORT_FILE" 2>/dev/null || true

echo "EC2 CI checkout complete."
echo "Report: $CI_REPORT_FILE"
