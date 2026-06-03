#!/usr/bin/env bash
set -euo pipefail

# Updates an already-bootstrapped Dokumen EC2 instance to ship Docker and host logs
# to CloudWatch Logs using infra/aws/bootstrap-ec2/start-cloudwatch.sh.
#
# Defaults are chosen for the current repo. Override any of these if needed:
#   AWS_REGION=us-east-1
#   INSTANCE_NAME=dokumen-ec2
#   EC2_INSTANCE_ID=i-...
#   SSH_PRIVATE_KEY_PATH="$HOME/.ssh/dokumen-ec2"
#   SSH_USER=ec2-user
#   CLOUDWATCH_LOG_GROUP_PREFIX=/dokumen/production/ec2
#   CLOUDWATCH_LOG_RETENTION_DAYS=14

AWS_REGION="${AWS_REGION:-us-east-1}"
INSTANCE_NAME="${INSTANCE_NAME:-dokumen-ec2}"
EC2_INSTANCE_ID="${EC2_INSTANCE_ID:-i-049bec154a177c291}"
SSH_PRIVATE_KEY_PATH="${SSH_PRIVATE_KEY_PATH:-${HOME}/.ssh/dokumen-ec2}"
SSH_USER="${SSH_USER:-ec2-user}"
CLOUDWATCH_LOG_GROUP_PREFIX="${CLOUDWATCH_LOG_GROUP_PREFIX:-/dokumen/production/ec2}"
CLOUDWATCH_LOG_RETENTION_DAYS="${CLOUDWATCH_LOG_RETENTION_DAYS:-14}"
LOCAL_SETUP_SCRIPT="${LOCAL_SETUP_SCRIPT:-infra/aws/bootstrap-ec2/start-cloudwatch.sh}"
REMOTE_SETUP_SCRIPT="${REMOTE_SETUP_SCRIPT:-/tmp/start-cloudwatch.sh}"

require_cmd() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Required command not found: ${name}" >&2
    exit 1
  fi
}

aws_region() {
  aws --region "$AWS_REGION" "$@"
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

resolve_public_ip() {
  local public_ip
  public_ip="$(
    aws_region ec2 describe-instances \
      --instance-ids "$EC2_INSTANCE_ID" \
      --query 'Reservations[0].Instances[0].PublicIpAddress' \
      --output text
  )"

  if [[ -z "$public_ip" || "$public_ip" == "None" ]]; then
    echo "Instance ${EC2_INSTANCE_ID} has no public IP. Set up SSM port/session access or attach an Elastic IP, then retry." >&2
    exit 1
  fi

  printf '%s' "$public_ip"
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

attach_cloudwatch_agent_policy() {
  local role_name="$1"
  aws iam attach-role-policy \
    --role-name "$role_name" \
    --policy-arn "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

copy_and_run_setup_script() {
  local public_ip="$1"
  local ssh_target="${SSH_USER}@${public_ip}"

  if [[ ! -f "$LOCAL_SETUP_SCRIPT" ]]; then
    echo "Local setup script not found: ${LOCAL_SETUP_SCRIPT}" >&2
    exit 1
  fi

  scp \
    -i "$SSH_PRIVATE_KEY_PATH" \
    -o StrictHostKeyChecking=accept-new \
    "$LOCAL_SETUP_SCRIPT" \
    "${ssh_target}:${REMOTE_SETUP_SCRIPT}"

  ssh \
    -i "$SSH_PRIVATE_KEY_PATH" \
    -o StrictHostKeyChecking=accept-new \
    "$ssh_target" \
    "chmod 0755 '${REMOTE_SETUP_SCRIPT}' && AWS_REGION='${AWS_REGION}' CLOUDWATCH_LOG_GROUP_PREFIX='${CLOUDWATCH_LOG_GROUP_PREFIX}' CLOUDWATCH_LOG_RETENTION_DAYS='${CLOUDWATCH_LOG_RETENTION_DAYS}' bash '${REMOTE_SETUP_SCRIPT}'"
}

print_log_group_summary() {
  aws_region logs describe-log-groups \
    --log-group-name-prefix "$CLOUDWATCH_LOG_GROUP_PREFIX" \
    --query 'logGroups[].{name:logGroupName,retention:retentionInDays,storedBytes:storedBytes}' \
    --output table
}

require_cmd aws
require_cmd scp
require_cmd ssh

resolve_instance_id
PUBLIC_IP="$(resolve_public_ip)"
ROLE_NAME="$(resolve_instance_role_name)"

echo "Target EC2 instance: ${EC2_INSTANCE_ID} (${PUBLIC_IP})"
echo "Attaching CloudWatchAgentServerPolicy to role: ${ROLE_NAME}"
attach_cloudwatch_agent_policy "$ROLE_NAME"

echo "Waiting briefly for IAM policy propagation..."
sleep 20

echo "Copying and running CloudWatch Logs setup script over SSH..."
copy_and_run_setup_script "$PUBLIC_IP"

echo "CloudWatch log groups matching ${CLOUDWATCH_LOG_GROUP_PREFIX}:"
print_log_group_summary
