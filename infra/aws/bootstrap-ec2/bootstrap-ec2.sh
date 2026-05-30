#!/usr/bin/env bash
set -euo pipefail

install_packages() {
  if ! command -v dnf >/dev/null 2>&1; then
    echo "Unsupported host OS: this bootstrap script requires dnf, such as on Amazon Linux 2023." >&2
    exit 1
  fi

  sudo dnf update -y
  sudo dnf install -y \
    amazon-ssm-agent \
    awscli \
    curl-minimal \
    docker \
    git \
    jq
}

enable_host_services() {
  sudo systemctl enable --now docker

  if systemctl list-unit-files amazon-ssm-agent.service >/dev/null 2>&1; then
    sudo systemctl enable --now amazon-ssm-agent
  fi

  if id ec2-user >/dev/null 2>&1; then
    sudo usermod -aG docker ec2-user
  fi
}

install_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    return
  fi

  curl -fsSL https://pkg.cloudflare.com/cloudflared.repo | sudo tee /etc/yum.repos.d/cloudflared.repo >/dev/null
  sudo dnf install -y cloudflared
}

install_docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    return
  fi

  local arch asset plugin_path
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) asset="docker-compose-linux-x86_64" ;;
    aarch64|arm64) asset="docker-compose-linux-aarch64" ;;
    *) echo "Unsupported architecture for automatic Docker Compose install: ${arch}" >&2; exit 1 ;;
  esac

  plugin_path="/usr/local/lib/docker/cli-plugins/docker-compose"
  sudo install -d -m 0755 "$(dirname "$plugin_path")"
  sudo curl -fsSL "https://github.com/docker/compose/releases/latest/download/${asset}" -o "$plugin_path"
  sudo chmod 0755 "$plugin_path"
}

verify_tools() {
  git --version >/dev/null
  aws --version >/dev/null
  jq --version >/dev/null
  docker compose version >/dev/null
  cloudflared --version >/dev/null
}

install_packages
enable_host_services
install_docker_compose
install_cloudflared
verify_tools

echo "EC2 host bootstrap complete. Host tools and cloudflared are installed."
