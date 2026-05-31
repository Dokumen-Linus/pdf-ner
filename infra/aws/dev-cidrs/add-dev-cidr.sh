#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/aws/shared/common.sh
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/../shared/common.sh"

load_env_file "${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
configure_common_defaults

RDS_PORT="${RDS_PORT:-5432}"
DEV_RDS_SG_NAME="${DEV_RDS_SG_NAME:-${PROJECT_NAME}-dev-rds-sg}"
DEV_CIDR="${DEV_CIDR:-}"
DEV_SECRETS_POLICY_NAME="${DEV_SECRETS_POLICY_NAME:-${PROJECT_NAME}-dev-local-secrets-read}"

: "${DEV_CIDR:?Set DEV_CIDR to the dev CIDR block to allow, for example 203.0.113.10/32}"

require_cidr() {
  local name="$1"
  local cidr="$2"
  local ip octet first second third fourth

  if [[ ! "$cidr" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$ ]]; then
    echo "${name} must be an IPv4 CIDR block, for example 203.0.113.10/32" >&2
    exit 1
  fi

  ip="${cidr%/*}"
  IFS=. read -r first second third fourth <<< "$ip"
  for octet in "$first" "$second" "$third" "$fourth"; do
    if ((10#$octet > 255)); then
      echo "${name} contains an invalid IPv4 octet: ${octet}" >&2
      exit 1
    fi
  done
}

resolve_security_group_id() {
  local label="$1"
  local group_id="$2"
  local group_name="$3"
  local vpc_id="$4"

  if [ -n "$group_id" ]; then
    printf '%s' "$group_id"
    return
  fi

  if [ -z "$group_name" ] || [ -z "$vpc_id" ]; then
    echo "Missing ${label} security group id. Set the explicit SG id, or set its name and VPC id." >&2
    exit 1
  fi

  group_id="$(get_security_group_id "$group_name" "$vpc_id")"
  if [ -z "$group_id" ]; then
    echo "Could not find ${label} security group named ${group_name} in ${vpc_id}" >&2
    exit 1
  fi

  printf '%s' "$group_id"
}

tcp_cidr_ingress_exists() {
  local group_id="$1"
  local port="$2"
  local cidr="$3"
  local rule_id

  rule_id="$(aws_region ec2 describe-security-group-rules \
    --filters "Name=group-id,Values=${group_id}" \
    --query "SecurityGroupRules[?IsEgress==\`false\` && IpProtocol==\`tcp\` && FromPort==\`${port}\` && ToPort==\`${port}\` && CidrIpv4=='${cidr}'].SecurityGroupRuleId | [0]" \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }')"

  [ -n "$rule_id" ]
}

authorize_dev_db_cidr() {
  local group_id="$1"
  local port="$2"
  local cidr="$3"

  if tcp_cidr_ingress_exists "$group_id" "$port" "$cidr"; then
    echo "Development RDS ${group_id} already allows tcp/${port} from ${cidr}"
    return
  fi

  aws_region ec2 authorize-security-group-ingress \
    --group-id "$group_id" \
    --protocol tcp \
    --port "$port" \
    --cidr "$cidr" >/dev/null
  echo "Added development RDS ${group_id} tcp/${port} access from ${cidr}"
}

dev_secret_resources_json() {
  local account_id="$1"

  cat <<EOF
[
  "arn:aws:secretsmanager:${AWS_REGION}:${account_id}:secret:dev/web-*",
  "arn:aws:secretsmanager:${AWS_REGION}:${account_id}:secret:dev/email-*",
  "arn:aws:secretsmanager:${AWS_REGION}:${account_id}:secret:dev/api-*",
  "arn:aws:secretsmanager:${AWS_REGION}:${account_id}:secret:dev/workers-*",
  "arn:aws:secretsmanager:${AWS_REGION}:${account_id}:secret:dev/runpod-*"
]
EOF
}

base_policy_document() {
  local resources_json="$1"

  cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": ${resources_json},
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "true"
        },
        "IpAddress": {
          "aws:SourceIp": []
        }
      }
    }
  ]
}
EOF
}

get_policy_arn() {
  aws iam list-policies \
    --scope Local \
    --query "Policies[?PolicyName=='${DEV_SECRETS_POLICY_NAME}'].Arn | [0]" \
    --output text | awk 'NF && $1 != "None" { print $1; exit }'
}

get_current_policy_document() {
  local policy_arn="$1"
  local version_id

  version_id="$(aws iam get-policy \
    --policy-arn "$policy_arn" \
    --query 'Policy.DefaultVersionId' \
    --output text)"

  aws iam get-policy-version \
    --policy-arn "$policy_arn" \
    --version-id "$version_id" \
    --query 'PolicyVersion.Document' \
    --output json
}

policy_document_with_cidr() {
  local policy_document="$1"
  local resources_json="$2"
  local cidr="$3"

  jq -c \
    --arg cidr "$cidr" \
    --argjson resources "$resources_json" \
    '
      .Statement[0].Resource = $resources
      | .Statement[0].Condition.Bool["aws:SecureTransport"] = "true"
      | .Statement[0].Condition.IpAddress["aws:SourceIp"] =
        (
          ([.Statement[0].Condition.IpAddress["aws:SourceIp"]] | flatten | map(select(. != null and . != "")))
          + [$cidr]
          | unique
        )
    ' <<< "$policy_document"
}

ensure_policy_version_limit() {
  local policy_arn="$1"
  local version_count oldest_non_default_version

  version_count="$(aws iam list-policy-versions \
    --policy-arn "$policy_arn" \
    --query 'length(Versions)' \
    --output text)"

  if [ "$version_count" -lt 5 ]; then
    return
  fi

  oldest_non_default_version="$(aws iam list-policy-versions \
    --policy-arn "$policy_arn" \
    --query "sort_by(Versions[?IsDefaultVersion==\`false\`], &CreateDate)[0].VersionId" \
    --output text)"

  if [ -n "$oldest_non_default_version" ] && [ "$oldest_non_default_version" != "None" ]; then
    aws iam delete-policy-version \
      --policy-arn "$policy_arn" \
      --version-id "$oldest_non_default_version"
  fi
}

create_or_update_dev_secrets_policy() {
  local cidr="$1"
  local account_id resources_json policy_arn current_document updated_document tag_args
  tag_args=("Key=Name,Value=${DEV_SECRETS_POLICY_NAME}" "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=${ENVIRONMENT}")

  account_id="$(aws sts get-caller-identity --query Account --output text)"
  resources_json="$(dev_secret_resources_json "$account_id")"
  policy_arn="$(get_policy_arn)"

  if [ -z "$policy_arn" ]; then
    current_document="$(base_policy_document "$resources_json")"
    updated_document="$(policy_document_with_cidr "$current_document" "$resources_json" "$cidr")"
    policy_arn="$(aws iam create-policy \
      --policy-name "$DEV_SECRETS_POLICY_NAME" \
      --policy-document "$updated_document" \
      --tags "${tag_args[@]}" \
      --query 'Policy.Arn' \
      --output text)"
  else
    current_document="$(get_current_policy_document "$policy_arn")"
    updated_document="$(policy_document_with_cidr "$current_document" "$resources_json" "$cidr")"
    ensure_policy_version_limit "$policy_arn"
    aws iam create-policy-version \
      --policy-arn "$policy_arn" \
      --policy-document "$updated_document" \
      --set-as-default >/dev/null
    aws iam tag-policy \
      --policy-arn "$policy_arn" \
      --tags "${tag_args[@]}" >/dev/null
  fi

  echo "Development secrets read policy allows ${cidr}: ${policy_arn}"

  if [ -n "${DEV_SECRETS_IAM_USER_NAME:-}" ]; then
    aws iam attach-user-policy \
      --user-name "$DEV_SECRETS_IAM_USER_NAME" \
      --policy-arn "$policy_arn"
    echo "Attached development secrets read policy to IAM user ${DEV_SECRETS_IAM_USER_NAME}"
  fi

  if [ -n "${DEV_SECRETS_IAM_ROLE_NAME:-}" ]; then
    aws iam attach-role-policy \
      --role-name "$DEV_SECRETS_IAM_ROLE_NAME" \
      --policy-arn "$policy_arn"
    echo "Attached development secrets read policy to IAM role ${DEV_SECRETS_IAM_ROLE_NAME}"
  fi

  if [ -z "${DEV_SECRETS_IAM_USER_NAME:-}" ] && [ -z "${DEV_SECRETS_IAM_ROLE_NAME:-}" ]; then
    echo "Set DEV_SECRETS_IAM_USER_NAME or DEV_SECRETS_IAM_ROLE_NAME to attach it automatically."
  fi
}

require_cidr DEV_CIDR "$DEV_CIDR"

DEV_RDS_SECURITY_GROUP_ID="$(resolve_security_group_id "development RDS" "${DEV_RDS_SG_ID:-}" "$DEV_RDS_SG_NAME" "${DEV_VPC_ID:-}")"

echo "Adding development CIDR access for ${PROJECT_NAME} in ${AWS_REGION}"
authorize_dev_db_cidr "$DEV_RDS_SECURITY_GROUP_ID" "$RDS_PORT" "$DEV_CIDR"
create_or_update_dev_secrets_policy "$DEV_CIDR"
echo "Development CIDR add complete."
