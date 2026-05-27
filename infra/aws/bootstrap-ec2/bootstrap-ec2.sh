#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE_ARG="${1:-}"
# shellcheck source=infra/aws/shared/common.sh
. "${SCRIPT_DIR}/../shared/common.sh"

load_env_file "${LOCAL_ENV_FILE:-${ENV_FILE_ARG:-${SCRIPT_DIR}/.env.local}}"

APP_DIR="${APP_DIR:-/opt/dokumen/pdf-ner}"
REPO_URL="${REPO_URL:-https://github.com/dokumenai/pdf-ner.git}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-master}"
ENV_FILE="${ENV_FILE:-infra/.env.prod}"
AWS_REGION="${AWS_REGION:-us-east-1}"

if [[ -z "${TUNNEL_TOKEN:-}" ]]; then
  echo "TUNNEL_TOKEN is required. Run infra/cloudflare/setup-tunnel/setup-tunnel.sh after setup-waf and copy its TUNNEL_TOKEN output."
  exit 1
fi

install_packages() {
  if ! command -v dnf >/dev/null 2>&1; then
    echo "Unsupported host OS: this bootstrap script requires dnf, such as on Amazon Linux 2023."
    exit 1
  fi

  sudo dnf update -y
  sudo dnf install -y \
    amazon-ssm-agent \
    awscli \
    curl-minimal \
    docker \
    docker-buildx-plugin \
    docker-compose-plugin \
    git \
    jq

  docker compose version >/dev/null
  docker buildx version >/dev/null
}

install_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    return
  fi

  local arch package_url
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) package_url="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.rpm" ;;
    aarch64|arm64) package_url="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.rpm" ;;
    *) echo "Unsupported architecture for automatic cloudflared install: ${arch}"; exit 1 ;;
  esac

  sudo dnf install -y "$package_url"
}

sync_repo() {
  sudo install -d -m 0755 "$(dirname "$APP_DIR")"
  if [[ -d "${APP_DIR}/.git" ]]; then
    sudo git -C "$APP_DIR" fetch origin "$DEPLOY_BRANCH"
    sudo git -C "$APP_DIR" checkout "$DEPLOY_BRANCH"
    sudo git -C "$APP_DIR" pull --ff-only origin "$DEPLOY_BRANCH"
  else
    sudo git clone --branch "$DEPLOY_BRANCH" "$REPO_URL" "$APP_DIR"
  fi
}

ensure_env_file() {
  if [[ -f "${APP_DIR}/${ENV_FILE}" ]]; then
    return
  fi

  if [[ -f "${APP_DIR}/infra/.env.prod.example" ]]; then
    sudo cp "${APP_DIR}/infra/.env.prod.example" "${APP_DIR}/${ENV_FILE}"
    echo "Created ${APP_DIR}/${ENV_FILE} from infra/.env.prod.example. Review public build variables before app deployment."
  else
    echo "${APP_DIR}/${ENV_FILE} is missing and infra/.env.prod.example was not found."
    exit 1
  fi
}

install_packages
install_cloudflared

sudo systemctl enable --now docker
if systemctl list-unit-files amazon-ssm-agent.service >/dev/null 2>&1; then
  sudo systemctl enable --now amazon-ssm-agent
fi

sync_repo
ensure_env_file

cd "$APP_DIR"
sudo docker compose -f infra/docker-compose.yml --env-file "$ENV_FILE" up -d --no-build redis

if systemctl list-unit-files cloudflared.service >/dev/null 2>&1; then
  sudo systemctl enable --now cloudflared
else
  sudo cloudflared service install "$TUNNEL_TOKEN"
fi

sudo systemctl is-active --quiet cloudflared
"${SCRIPT_DIR}/verify-cloudflare-origin.sh"
echo "EC2 runtime bootstrap complete. Redis is started and cloudflared.service is active."
