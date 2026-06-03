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
EC2_APP_DIR="${EC2_APP_DIR:-${APP_DIR:-/opt/dokumen/pdf-ner}}"
LOCAL_HEALTHCHECK_SCRIPT="${LOCAL_HEALTHCHECK_SCRIPT:-${SCRIPT_DIR}/ec2-healthcheck.sh}"

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

build_remote_command() {
  local payload remote_path remote_dir remote_path_q remote_dir_q
  payload="$(base64 < "$LOCAL_HEALTHCHECK_SCRIPT" | tr -d '\n')"
  remote_path="${EC2_APP_DIR%/}/infra/aws/health/ec2-healthcheck.sh"
  remote_dir="${remote_path%/*}"
  printf -v remote_path_q '%q' "$remote_path"
  printf -v remote_dir_q '%q' "$remote_dir"

  cat <<EOF
install -d -m 0755 ${remote_dir_q}
tmp_file="\$(mktemp)"
base64 --decode > "\$tmp_file" <<'HEALTHCHECK_PAYLOAD'
${payload}
HEALTHCHECK_PAYLOAD
install -m 0755 "\$tmp_file" ${remote_path_q}
rm -f "\$tmp_file"
test -s ${remote_path_q}
echo "Updated ${remote_path}"
EOF
}

run_ssm_command() {
  local remote_command="$1"
  local parameters_file command_id send_status wait_status
  parameters_file="$(mktemp)"
  jq -n --arg command "$remote_command" '{commands:["set -euo pipefail",$command]}' > "$parameters_file"

  set +e
  command_id="$(aws_region ssm send-command \
    --instance-ids "$EC2_INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --comment "Replace Dokumen EC2 healthcheck script" \
    --parameters "file://${parameters_file}" \
    --query "Command.CommandId" \
    --output text)"
  send_status=$?
  rm -f "$parameters_file"
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

  aws_region ssm get-command-invocation \
    --command-id "$command_id" \
    --instance-id "$EC2_INSTANCE_ID" \
    --query '{Status:Status,StandardOutput:StandardOutputContent,StandardError:StandardErrorContent}' \
    --output json

  return "$wait_status"
}

require_cmd aws
require_cmd base64
require_cmd jq

if [[ ! -f "$LOCAL_HEALTHCHECK_SCRIPT" ]]; then
  echo "Local healthcheck script not found: ${LOCAL_HEALTHCHECK_SCRIPT}" >&2
  exit 1
fi

resolve_instance_id
echo "Pushing ${LOCAL_HEALTHCHECK_SCRIPT} to ${EC2_INSTANCE_ID}:${EC2_APP_DIR%/}/infra/aws/health/ec2-healthcheck.sh"
run_ssm_command "$(build_remote_command)"
echo "Healthcheck script push complete."
