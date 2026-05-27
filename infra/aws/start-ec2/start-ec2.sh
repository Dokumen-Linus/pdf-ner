#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE_ARG="${1:-}"
# shellcheck source=infra/aws/shared/common.sh
. "${SCRIPT_DIR}/../shared/common.sh"

BOOTSTRAP_ENV_FILE="${LOCAL_ENV_FILE:-${ENV_FILE_ARG:-${SCRIPT_DIR}/../bootstrap-ec2/.env.local}}"
load_env_file "$BOOTSTRAP_ENV_FILE"

APP_DIR="${APP_DIR:-/opt/dokumen/pdf-ner}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-infra/.env.prod}"
HEALTHCHECK_SCRIPT="${HEALTHCHECK_SCRIPT:-infra/aws/health/ec2-healthcheck.sh}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

resolve_under_app_dir() {
  local path="$1"
  case "$path" in
    /*) printf '%s\n' "$path" ;;
    *) printf '%s/%s\n' "$APP_DIR" "$path" ;;
  esac
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || fail "${command_name} is required. Run bootstrap-ec2 first."
}

load_runtime_env() {
  local resolved_env_file="$1"
  set -a
  # shellcheck disable=SC1090
  . "$resolved_env_file"
  set +a
}

require_public_web_env() {
  local name value
  for name in VITE_BASE_URL VITE_STRIPE_PUBLISHABLE_KEY; do
    value="${!name:-}"
    if [[ -z "$value" || "$value" == REPLACE_* ]]; then
      fail "${name} must be set to a real public web build value in ${RESOLVED_ENV_FILE}."
    fi
  done
}

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

container_status() {
  local container_id="$1"
  docker inspect --format '{{.State.Status}}' "$container_id"
}

check_bootstrap() {
  [[ -d "$APP_DIR/.git" ]] || fail "${APP_DIR} is not a git checkout. Run bootstrap-ec2 first."
  [[ -f "$COMPOSE_FILE" ]] || fail "${COMPOSE_FILE} is missing under ${APP_DIR}."
  [[ -f "$RESOLVED_ENV_FILE" ]] || fail "${RESOLVED_ENV_FILE} is missing. Run bootstrap-ec2 first."

  require_command docker
  docker info >/dev/null || fail "Docker daemon is not available. Run bootstrap-ec2 first."
  docker compose version >/dev/null || fail "Docker Compose v2 is not available. Run bootstrap-ec2 first."
  docker buildx version >/dev/null || fail "Docker Buildx is not available. Run bootstrap-ec2 first."
}

check_redis() {
  local container_id status
  container_id="$(compose ps -q redis | head -n 1)"
  [[ -n "$container_id" ]] || fail "Redis container is missing. Run bootstrap-ec2 first."

  status="$(container_status "$container_id")"
  [[ "$status" == "running" ]] || fail "Redis container is ${status}, expected running."

  compose exec -T redis redis-cli ping | grep -qx PONG \
    || fail "Redis did not return PONG."
}

check_cloudflared() {
  command -v systemctl >/dev/null 2>&1 || fail "systemctl is required to check cloudflared.service."
  systemctl is-active --quiet cloudflared \
    || fail "cloudflared.service is not active. Run bootstrap-ec2 first."
}

run_healthcheck() {
  [[ -f "$HEALTHCHECK_SCRIPT" ]] || fail "${HEALTHCHECK_SCRIPT} is missing under ${APP_DIR}."
  bash "$HEALTHCHECK_SCRIPT"
}

RESOLVED_ENV_FILE="$(resolve_under_app_dir "$ENV_FILE")"

cd "$APP_DIR"
check_bootstrap
load_runtime_env "$RESOLVED_ENV_FILE"
require_public_web_env
check_redis
check_cloudflared

compose build web api worker
compose up -d --no-build web api worker
run_healthcheck

echo "EC2 app start complete. Web, API, and worker services are running."
