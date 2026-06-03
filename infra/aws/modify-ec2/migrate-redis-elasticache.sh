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
ELASTICACHE_REPLICATION_GROUP_ID="${ELASTICACHE_REPLICATION_GROUP_ID:-${PROJECT_NAME}-redis}"
ELASTICACHE_HEALTH_POLICY_NAME="${ELASTICACHE_HEALTH_POLICY_NAME:-${PROJECT_NAME}-elasticache-health-read}"
USE_SSH_FALLBACK="${USE_SSH_FALLBACK:-0}"
SSH_PRIVATE_KEY_PATH="${SSH_PRIVATE_KEY_PATH:-${HOME}/.ssh/dokumen-ec2}"
SSH_USER="${SSH_USER:-ec2-user}"

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

resolve_instance_role_name() {
  local profile_arn profile_name role_name
  profile_arn="$(
    aws_region ec2 describe-iam-instance-profile-associations \
      --filters "Name=instance-id,Values=${EC2_INSTANCE_ID}" "Name=state,Values=associated" \
      --query 'IamInstanceProfileAssociations[0].IamInstanceProfile.Arn' \
      --output text
  )"

  if [[ -z "$profile_arn" || "$profile_arn" == "None" ]]; then
    echo "Instance ${EC2_INSTANCE_ID} does not have an associated IAM instance profile." >&2
    exit 1
  fi

  profile_name="${profile_arn##*/}"
  role_name="$(
    aws iam get-instance-profile \
      --instance-profile-name "$profile_name" \
      --query 'InstanceProfile.Roles[0].RoleName' \
      --output text
  )"

  if [[ -z "$role_name" || "$role_name" == "None" ]]; then
    echo "Instance profile ${profile_name} has no role." >&2
    exit 1
  fi

  printf '%s' "$role_name"
}

attach_elasticache_health_policy() {
  local role_name="$1"
  local policy_document
  policy_document=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "elasticache:DescribeReplicationGroups"
      ],
      "Resource": "*"
    }
  ]
}
EOF
)

  aws iam put-role-policy \
    --role-name "$role_name" \
    --policy-name "$ELASTICACHE_HEALTH_POLICY_NAME" \
    --policy-document "$policy_document"
}

assert_elasticache_ready() {
  local status
  status="$(
    aws_region elasticache describe-replication-groups \
      --replication-group-id "$ELASTICACHE_REPLICATION_GROUP_ID" \
      --query 'ReplicationGroups[0].Status' \
      --output text 2>/dev/null || true
  )"

  if [[ "$status" != "available" ]]; then
    echo "ElastiCache replication group ${ELASTICACHE_REPLICATION_GROUP_ID} is ${status:-missing}, expected available." >&2
    echo "Run infra/aws/setup-elasticache/setup-elasticache.sh before this REPLACE script." >&2
    exit 1
  fi
}

build_remote_migration_command() {
  local app_dir_q
  printf -v app_dir_q '%q' "$EC2_APP_DIR"

  cat <<EOF
APP_DIR=${app_dir_q}
COMPOSE_FILE="\${APP_DIR%/}/infra/docker-compose.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed on this EC2 instance." >&2
  exit 1
fi

docker info >/dev/null

if [[ ! -s "\$COMPOSE_FILE" ]]; then
  echo "Missing production Compose file: \${COMPOSE_FILE}" >&2
  echo "Run infra/aws/modify-ec2/push-docker-compose.sh before this Redis migration script." >&2
  exit 1
fi

if awk '
  /^[[:space:]]*services:[[:space:]]*($|#)/ { in_services = 1; next }
  /^[^[:space:]#][^:]*:[[:space:]]*($|#)/ { in_services = 0 }
  in_services && /^[[:space:]]{2}redis:[[:space:]]*($|#)/ { found = 1 }
  END { exit found ? 0 : 1 }
' "\$COMPOSE_FILE"; then
  echo "Production Compose file still defines a redis service: \${COMPOSE_FILE}" >&2
  exit 1
fi

if grep -Eq '^[[:space:]]{2}redis_data:[[:space:]]*($|#)' "\$COMPOSE_FILE"; then
  echo "Production Compose file still defines a redis_data volume: \${COMPOSE_FILE}" >&2
  exit 1
fi

container_ids_for_redis() {
  {
    docker ps -aq --filter label=com.docker.compose.service=redis
    docker ps -aq --filter name=redis
  } | awk 'NF && !seen[\$0]++'
}

volume_names_for_redis() {
  {
    docker volume ls -q --filter label=com.docker.compose.volume=redis_data
    docker volume ls -q --filter name=redis_data
  } | awk 'NF && !seen[\$0]++'
}

image_ids_for_redis() {
  docker image ls --format '{{.Repository}} {{.ID}}' | awk '\$1 == "redis" { print \$2 }' | awk 'NF && !seen[\$0]++'
}

remove_legacy_redis_containers() {
  local ids
  mapfile -t ids < <(container_ids_for_redis)
  if (( \${#ids[@]} == 0 )); then
    echo "No legacy Redis containers found."
    return
  fi

  echo "Removing legacy Redis containers: \${ids[*]}"
  docker rm -f "\${ids[@]}" >/dev/null
}

remove_legacy_redis_volumes() {
  local names
  mapfile -t names < <(volume_names_for_redis)
  if (( \${#names[@]} == 0 )); then
    echo "No legacy Redis volumes found."
    return
  fi

  echo "Removing legacy Redis volumes: \${names[*]}"
  docker volume rm "\${names[@]}" >/dev/null
}

remove_legacy_redis_images() {
  local ids
  mapfile -t ids < <(image_ids_for_redis)
  if (( \${#ids[@]} == 0 )); then
    echo "No local Redis images found."
    return
  fi

  echo "Removing local Redis images: \${ids[*]}"
  docker image rm "\${ids[@]}" >/dev/null
}

assert_legacy_redis_gone() {
  local remaining_containers remaining_volumes
  mapfile -t remaining_containers < <(container_ids_for_redis)
  mapfile -t remaining_volumes < <(volume_names_for_redis)

  if (( \${#remaining_containers[@]} > 0 )); then
    echo "Legacy Redis containers still exist: \${remaining_containers[*]}" >&2
    exit 1
  fi

  if (( \${#remaining_volumes[@]} > 0 )); then
    echo "Legacy Redis volumes still exist: \${remaining_volumes[*]}" >&2
    exit 1
  fi
}

remove_legacy_redis_containers
remove_legacy_redis_volumes
remove_legacy_redis_images
assert_legacy_redis_gone

echo "Redis Compose artifacts removed. App services were not started or restarted."
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
    --comment "Replace Redis Compose with ElastiCache: ${label}" \
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

run_host_migration() {
  run_remote_or_fallback "remove Redis artifacts" "$(build_remote_migration_command)"
}

require_cmd aws
require_cmd base64
resolve_instance_id
ROLE_NAME="$(resolve_instance_role_name)"

assert_elasticache_ready
attach_elasticache_health_policy "$ROLE_NAME"
echo "Waiting briefly for IAM policy propagation..."
sleep 20
run_host_migration

echo "Existing EC2 instance ${EC2_INSTANCE_ID} is prepared for ElastiCache-backed Redis secrets."
echo "Next deploy path: run infra/aws/push-secrets/update-secrets.sh, then .github/workflows/deploy-stack.yml."
