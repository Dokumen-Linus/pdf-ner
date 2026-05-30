#!/usr/bin/env bash
set -euo pipefail

require_env_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "${name} is required. Export it before running start-tunnel.sh." >&2
    exit 1
  fi
}

require_env_var TUNNEL_TOKEN

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed. Run bootstrap-ec2.sh first." >&2
  exit 1
fi

if systemctl cat cloudflared.service >/dev/null 2>&1; then
  sudo systemctl enable --now cloudflared
else
  sudo cloudflared service install "$TUNNEL_TOKEN"
  sudo systemctl enable --now cloudflared
fi

sudo systemctl is-active --quiet cloudflared
echo "cloudflared.service is active."
