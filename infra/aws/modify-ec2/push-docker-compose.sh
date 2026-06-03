#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/aws/shared/common.sh
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/../shared/common.sh"

load_env_file "${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
configure_common_defaults

EC2_INSTANCE_ID="${EC2_INSTANCE_ID:-${INSTANCE_ID:-}}"
INSTANCE_NAME="${INSTANCE_NAME:-${PROJECT_NAME}-ec2}"
EC2_APP_DIR="${EC2_APP_DIR:-/opt/dokumen/pdf-ner}"
LOCAL_COMPOSE_FILE="${LOCAL_COMPOSE_FILE:-${REPO_ROOT}/infra/docker-compose.yml}"
USE_SSH_FALLBACK="${USE_SSH_FALLBACK:-0}"
SSH_PRIVATE_KEY_PATH="${SSH_PRIVATE_KEY_PATH:-${HOME}/.ssh/dokumen-ec2}"
SSH_USER="${SSH_USER:-ec2-user}"

LOCAL_COMPOSE_FILE="$(absolute_repo_path "$LOCAL_COMPOSE_FILE")"

require_cmd() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Required command not found: ${name}" >&2
    exit 1
  fi
}

resolve_instance_id() {
  if [[ -n "$EC2_INSTANCE_ID" ]]; then
    return
  fi

  EC2_INSTANCE_ID="$(
    aws_region ec2 describe-instances \
      --filters "Name=tag:Name,Values=${INSTANCE_NAME}" "Name=instance-state-name,Values=running" \
      --query 'Reservations[].Instances[].InstanceId | [0]' \
      --output text
  )"

  if [[ -z "$EC2_INSTANCE_ID" || "$EC2_INSTANCE_ID" == "None" ]]; then
    echo "Could not find a running EC2 instance tagged Name=${INSTANCE_NAME}. Set EC2_INSTANCE_ID and retry." >&2
    exit 1
  fi
}

assert_local_compose_has_no_redis() {
  if awk '
    /^[[:space:]]*services:[[:space:]]*($|#)/ { in_services = 1; next }
    /^[^[:space:]#][^:]*:[[:space:]]*($|#)/ { in_services = 0 }
    in_services && /^[[:space:]]{2}redis:[[:space:]]*($|#)/ { found = 1 }
    END { exit found ? 0 : 1 }
  ' "$LOCAL_COMPOSE_FILE"; then
    echo "Local production Compose file still defines a redis service: ${LOCAL_COMPOSE_FILE}" >&2
    exit 1
  fi

  if grep -Eq '^[[:space:]]{2}redis_data:[[:space:]]*($|#)' "$LOCAL_COMPOSE_FILE"; then
    echo "Local production Compose file still defines a redis_data volume: ${LOCAL_COMPOSE_FILE}" >&2
    exit 1
  fi
}

build_remote_push_command() {
  local payload remote_path remote_dir remote_path_q remote_dir_q
  payload="$(base64 < "$LOCAL_COMPOSE_FILE" | tr -d '\n')"
  remote_path="${EC2_APP_DIR%/}/infra/docker-compose.yml"
  remote_dir="${remote_path%/*}"
  printf -v remote_path_q '%q' "$remote_path"
  printf -v remote_dir_q '%q' "$remote_dir"

  cat <<EOF
install -d -m 0755 ${remote_dir_q}
tmp_compose="\$(mktemp)"
base64 --decode > "\$tmp_compose" <<'COMPOSE_PAYLOAD'
${payload}
COMPOSE_PAYLOAD
install -m 0644 "\$tmp_compose" ${remote_path_q}
rm -f "\$tmp_compose"
test -s ${remote_path_q}
echo "Updated ${remote_path}"
EOF
}

run_ssm_command() {
  local label="$1"
  local remote_command="$2"
  local command_id encoded_command send_status wait_status wrapped_command

  echo "Running on EC2 through SSM: ${label}"
  remote_command=$'set -euo pipefail\n'"$remote_command"
  encoded_command="$(printf '%s' "$remote_command" | base64 | tr -d '\n')"
  wrapped_command="printf %s ${encoded_command} | base64 --decode | bash -s"

  set +e
  command_id="$(aws_region ssm send-command \
    --instance-ids "$EC2_INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --comment "Push production docker-compose.yml: ${label}" \
    --parameters "commands=${wrapped_command}" \
    --query "Command.CommandId" \
    --output text)"
  send_status=$?
  set -e

  if (( send_status != 0 )); then
    return "$send_status"
  fi

  echo "SSM command id: ${command_id}"

  set +e
  aws_region ssm wait command-executed \
    --command-id "$command_id" \
    --instance-id "$EC2_INSTANCE_ID"
  wait_status=$?
  set -e

  echo "SSM status:"
  aws_region ssm get-command-invocation \
    --command-id "$command_id" \
    --instance-id "$EC2_INSTANCE_ID" \
    --query "Status" \
    --output text
  echo "SSM stdout:"
  aws_region ssm get-command-invocation \
    --command-id "$command_id" \
    --instance-id "$EC2_INSTANCE_ID" \
    --query "StandardOutputContent" \
    --output text
  echo "SSM stderr:"
  aws_region ssm get-command-invocation \
    --command-id "$command_id" \
    --instance-id "$EC2_INSTANCE_ID" \
    --query "StandardErrorContent" \
    --output text

  return "$wait_status"
}

resolve_public_ip() {
  aws_region ec2 describe-instances \
    --instance-ids "$EC2_INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text
}

run_ssh_command() {
  local remote_command="$1"
  local public_ip ssh_target
  public_ip="$(resolve_public_ip)"
  if [[ -z "$public_ip" || "$public_ip" == "None" ]]; then
    echo "Instance ${EC2_INSTANCE_ID} has no public IP for SSH fallback." >&2
    exit 1
  fi
  ssh_target="${SSH_USER}@${public_ip}"
  ssh \
    -i "$SSH_PRIVATE_KEY_PATH" \
    -o StrictHostKeyChecking=accept-new \
    "$ssh_target" \
    "set -euo pipefail; ${remote_command}"
}

run_remote_or_fallback() {
  local label="$1"
  local remote_command="$2"
  if run_ssm_command "$label" "$remote_command"; then
    return
  fi

  if [[ "$USE_SSH_FALLBACK" == "1" ]]; then
    echo "SSM ${label} failed; retrying through explicit SSH fallback."
    run_ssh_command "$remote_command"
    return
  fi

  echo "SSM ${label} failed. Set USE_SSH_FALLBACK=1 only if SSM is unavailable and SSH is necessary." >&2
  exit 1
}

require_cmd aws
require_cmd base64
if [[ ! -f "$LOCAL_COMPOSE_FILE" ]]; then
  echo "Local Compose file not found: ${LOCAL_COMPOSE_FILE}" >&2
  exit 1
fi

assert_local_compose_has_no_redis
resolve_instance_id
run_remote_or_fallback "replace docker-compose.yml" "$(build_remote_push_command)"

echo "Pushed ${LOCAL_COMPOSE_FILE} to ${EC2_INSTANCE_ID}:${EC2_APP_DIR%/}/infra/docker-compose.yml."
