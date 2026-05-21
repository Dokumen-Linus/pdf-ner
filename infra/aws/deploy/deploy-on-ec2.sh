#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/deploy-aws/shared/common.sh
. "${SCRIPT_DIR}/../shared/common.sh"

load_env_file "${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
configure_common_defaults

declare ELASTIC_IP
declare REMOTE_APP_DIR
declare PROD_ENV_FILE
declare SSH_PRIVATE_KEY_PATH
declare SSH_CONNECT_TIMEOUT
declare SSH_SERVER_ALIVE_INTERVAL
declare SSH_SERVER_ALIVE_COUNT_MAX
declare SSH_WAIT_ATTEMPTS
declare SSH_WAIT_SECONDS
declare CLEAR_DOCKER_BUILD_CACHE

: "${ELASTIC_IP}"
: "${REMOTE_APP_DIR}"
: "${PROD_ENV_FILE}"
: "${SSH_PRIVATE_KEY_PATH}"
: "${SSH_CONNECT_TIMEOUT}"
: "${SSH_SERVER_ALIVE_INTERVAL}"
: "${SSH_SERVER_ALIVE_COUNT_MAX}"
: "${SSH_WAIT_ATTEMPTS}"
: "${SSH_WAIT_SECONDS}"
: "${CLEAR_DOCKER_BUILD_CACHE}"

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
    echo "Target: ec2-user@$elastic_ip" >&2
  else
    echo "ERROR: EC2 remote command failed during deployment step: $label (exit $status)" >&2
  fi

  return "$status"
}

echo "Deploying ${PROJECT_NAME} to EC2 in ${AWS_REGION}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

echo "SSH target: ec2-user@${ELASTIC_IP}"
echo "Remote app dir: ${REMOTE_APP_DIR}"
echo "Clear Docker cache: ${CLEAR_DOCKER_BUILD_CACHE}"
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

printf -v clear_docker_build_cache_q '%q' "$CLEAR_DOCKER_BUILD_CACHE"
printf -v aws_region_q '%q' "$AWS_REGION"

echo "Checking prepared remote app checkout..."
ec2_deploy_remote_run "check remote app checkout" "$ELASTIC_IP" "test -f '${REMOTE_APP_DIR}/infra/docker-compose.yml'"

if [ -f "$PROD_ENV_FILE" ]; then
  echo "Uploading production bootstrap env to EC2..."
  scp \
    -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout="$SSH_CONNECT_TIMEOUT" \
    -i "$SSH_PRIVATE_KEY_PATH" \
    "$PROD_ENV_FILE" \
    "ec2-user@${ELASTIC_IP}:${REMOTE_APP_DIR}/infra/.env.prod"
else
  echo "Production bootstrap env was not found at ${PROD_ENV_FILE}; skipping upload."
fi

echo "Starting Docker Compose stack..."
ec2_deploy_remote_run "start Docker Compose stack" "$ELASTIC_IP" "set -euo pipefail
  cd '$REMOTE_APP_DIR'
  export COMPOSE_PARALLEL_LIMIT=1
  CLEAR_DOCKER_BUILD_CACHE_VALUE=$clear_docker_build_cache_q
  if [ \"\$CLEAR_DOCKER_BUILD_CACHE_VALUE\" = \"1\" ]; then
    docker container prune -f || true
    docker image prune -af || true
    docker builder prune -af || true
    docker buildx prune -af || true
  fi
  docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build
  if [ \"\$CLEAR_DOCKER_BUILD_CACHE_VALUE\" = \"1\" ]; then
    docker image prune -af || true
    docker builder prune -af || true
    docker buildx prune -af || true
  fi"

echo "Running EC2 healthcheck..."
ec2_deploy_remote_run "run EC2 healthcheck" "$ELASTIC_IP" "set -euo pipefail
  cd '$REMOTE_APP_DIR'
  AWS_REGION=$aws_region_q bash infra/health/ec2-healthcheck.sh"

DEPLOY_REPORT_FILE="${OUTPUT_DIR}/deploy-report.txt"
ensure_output_dir
cat > "$DEPLOY_REPORT_FILE" <<EOF
Dokumen EC2 deploy
Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')

AWS_REGION=${AWS_REGION}
PROJECT_NAME=${PROJECT_NAME}
ACCOUNT_ID=${ACCOUNT_ID}
ELASTIC_IP=${ELASTIC_IP}
REMOTE_APP_DIR=${REMOTE_APP_DIR}
CLEAR_DOCKER_BUILD_CACHE=${CLEAR_DOCKER_BUILD_CACHE}
EOF
chmod 600 "$DEPLOY_REPORT_FILE" 2>/dev/null || true

echo "Deploy complete."
echo "Report: $DEPLOY_REPORT_FILE"
