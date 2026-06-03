#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/aws/shared/common.sh
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/../shared/common.sh"

load_env_file "${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
configure_common_defaults

VPC_ID="${VPC_ID:-}"
PRIVATE_SUBNET_ID="${PRIVATE_SUBNET_ID:-}"
PRIVATE_SUBNET_2_ID="${PRIVATE_SUBNET_2_ID:-}"
SG_ID="${SG_ID:-}"
ELASTICACHE_REPLICATION_GROUP_ID="${ELASTICACHE_REPLICATION_GROUP_ID:-${PROJECT_NAME}-redis}"
ELASTICACHE_SUBNET_GROUP_NAME="${ELASTICACHE_SUBNET_GROUP_NAME:-${PROJECT_NAME}-prod-elasticache-subnets}"
ELASTICACHE_SG_NAME="${ELASTICACHE_SG_NAME:-${PROJECT_NAME}-prod-elasticache-sg}"
ELASTICACHE_ENGINE="${ELASTICACHE_ENGINE:-redis}"
ELASTICACHE_ENGINE_VERSION="${ELASTICACHE_ENGINE_VERSION:-7.1}"
ELASTICACHE_NODE_TYPE="${ELASTICACHE_NODE_TYPE:-cache.t4g.micro}"
ELASTICACHE_PORT="${ELASTICACHE_PORT:-6379}"
ELASTICACHE_AUTH_TOKEN="${ELASTICACHE_AUTH_TOKEN:-}"
EXISTING_ELASTICACHE_AUTH_TOKEN_CONFIRMED="${EXISTING_ELASTICACHE_AUTH_TOKEN_CONFIRMED:-0}"
ELASTICACHE_SNAPSHOT_RETENTION_DAYS="${ELASTICACHE_SNAPSHOT_RETENTION_DAYS:-7}"
ELASTICACHE_SNAPSHOT_WINDOW="${ELASTICACHE_SNAPSHOT_WINDOW:-07:00-08:00}"
ELASTICACHE_WAIT_POLL_SECONDS="${ELASTICACHE_WAIT_POLL_SECONDS:-30}"

: "${VPC_ID:?Set VPC_ID before running setup-elasticache.sh}"
: "${PRIVATE_SUBNET_ID:?Set PRIVATE_SUBNET_ID before running setup-elasticache.sh}"
: "${PRIVATE_SUBNET_2_ID:?Set PRIVATE_SUBNET_2_ID before running setup-elasticache.sh}"
: "${SG_ID:?Set SG_ID to the EC2 security group before running setup-elasticache.sh}"
: "${ELASTICACHE_AUTH_TOKEN:?Set ELASTICACHE_AUTH_TOKEN before running setup-elasticache.sh}"

validate_auth_token() {
  if [[ ! "$ELASTICACHE_AUTH_TOKEN" =~ ^[A-Za-z0-9!\&\#\$\^\<\>-]{16,128}$ ]]; then
    echo "ELASTICACHE_AUTH_TOKEN must be 16-128 characters and may only contain alphanumerics plus !, &, #, $, ^, <, >, and -." >&2
    exit 1
  fi
  if [[ ! "$ELASTICACHE_SNAPSHOT_RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]]; then
    echo "ELASTICACHE_SNAPSHOT_RETENTION_DAYS must be a positive integer so automatic backups stay enabled." >&2
    exit 1
  fi
}

log_step() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

declare -a ELASTICACHE_TAGS=()

set_elasticache_tags() {
  local name="$1"
  ELASTICACHE_TAGS=(
    "Key=Name,Value=${name}"
    "Key=Project,Value=${PROJECT_NAME}"
    "Key=Environment,Value=${ENVIRONMENT}"
  )
}

elasticache_tag_json() {
  local name="$1"
  jq -n \
    --arg name "$name" \
    --arg project "$PROJECT_NAME" \
    --arg environment "$ENVIRONMENT" \
    '[{Key:"Name",Value:$name},{Key:"Project",Value:$project},{Key:"Environment",Value:$environment}]'
}

ensure_cache_subnet_group() {
  local subnet_group_arn current_subnet_ids desired_subnet_ids
  log_step "Ensuring ElastiCache subnet group ${ELASTICACHE_SUBNET_GROUP_NAME} includes ${PRIVATE_SUBNET_ID} and ${PRIVATE_SUBNET_2_ID}."
  if aws_region elasticache describe-cache-subnet-groups \
    --cache-subnet-group-name "$ELASTICACHE_SUBNET_GROUP_NAME" >/dev/null 2>&1; then
    current_subnet_ids="$(
      aws_region elasticache describe-cache-subnet-groups \
        --cache-subnet-group-name "$ELASTICACHE_SUBNET_GROUP_NAME" \
        --query 'sort_by(CacheSubnetGroups[0].Subnets[].SubnetIdentifier, &@)' \
        --output text
    )"
    desired_subnet_ids="$(printf '%s\n%s\n' "$PRIVATE_SUBNET_ID" "$PRIVATE_SUBNET_2_ID" | sort | tr '\n' '\t' | sed 's/[[:space:]]*$//')"
    if [[ "$current_subnet_ids" == "$desired_subnet_ids" ]]; then
      log_step "ElastiCache subnet group ${ELASTICACHE_SUBNET_GROUP_NAME} already has the desired subnets."
    else
      log_step "Modifying existing ElastiCache subnet group ${ELASTICACHE_SUBNET_GROUP_NAME}."
      aws_region elasticache modify-cache-subnet-group \
        --cache-subnet-group-name "$ELASTICACHE_SUBNET_GROUP_NAME" \
        --cache-subnet-group-description "Dokumen production ElastiCache private subnets" \
        --subnet-ids "$PRIVATE_SUBNET_ID" "$PRIVATE_SUBNET_2_ID" >/dev/null
    fi
  else
    log_step "Creating ElastiCache subnet group ${ELASTICACHE_SUBNET_GROUP_NAME}."
    set_elasticache_tags "$ELASTICACHE_SUBNET_GROUP_NAME"
    aws_region elasticache create-cache-subnet-group \
      --cache-subnet-group-name "$ELASTICACHE_SUBNET_GROUP_NAME" \
      --cache-subnet-group-description "Dokumen production ElastiCache private subnets" \
      --subnet-ids "$PRIVATE_SUBNET_ID" "$PRIVATE_SUBNET_2_ID" \
      --tags "${ELASTICACHE_TAGS[@]}" >/dev/null
  fi

  subnet_group_arn="$(aws_region elasticache describe-cache-subnet-groups \
    --cache-subnet-group-name "$ELASTICACHE_SUBNET_GROUP_NAME" \
    --query 'CacheSubnetGroups[0].ARN' \
    --output text 2>/dev/null || true)"
  if [[ -n "$subnet_group_arn" && "$subnet_group_arn" != "None" ]]; then
    log_step "Tagging ElastiCache subnet group ${ELASTICACHE_SUBNET_GROUP_NAME}."
    set_elasticache_tags "$ELASTICACHE_SUBNET_GROUP_NAME"
    aws_region elasticache add-tags-to-resource \
      --resource-name "$subnet_group_arn" \
      --tags "${ELASTICACHE_TAGS[@]}" >/dev/null
  fi
}

replication_group_exists() {
  aws_region elasticache describe-replication-groups \
    --replication-group-id "$ELASTICACHE_REPLICATION_GROUP_ID" >/dev/null 2>&1
}

assert_existing_auth_token_confirmed() {
  local auth_enabled
  auth_enabled="$(
    aws_region elasticache describe-replication-groups \
      --replication-group-id "$ELASTICACHE_REPLICATION_GROUP_ID" \
      --query 'ReplicationGroups[0].AuthTokenEnabled' \
      --output text
  )"

  if [[ "$auth_enabled" != "True" && "$auth_enabled" != "true" ]]; then
    echo "Existing ElastiCache replication group ${ELASTICACHE_REPLICATION_GROUP_ID} does not report AUTH enabled." >&2
    exit 1
  fi

  if [[ "$EXISTING_ELASTICACHE_AUTH_TOKEN_CONFIRMED" != "1" ]]; then
    echo "Existing ElastiCache replication group ${ELASTICACHE_REPLICATION_GROUP_ID} cannot reveal its current AUTH token." >&2
    echo "Set EXISTING_ELASTICACHE_AUTH_TOKEN_CONFIRMED=1 only after confirming ELASTICACHE_AUTH_TOKEN is the live token." >&2
    exit 1
  fi
}

create_replication_group() {
  local create_args
  log_step "Creating ElastiCache replication group ${ELASTICACHE_REPLICATION_GROUP_ID}; this can take several minutes."
  create_args=(
    --replication-group-id "$ELASTICACHE_REPLICATION_GROUP_ID"
    --replication-group-description "Dokumen production Redis"
    --engine "$ELASTICACHE_ENGINE"
    --cache-node-type "$ELASTICACHE_NODE_TYPE"
    --cache-subnet-group-name "$ELASTICACHE_SUBNET_GROUP_NAME"
    --security-group-ids "$ELASTICACHE_SG_ID"
    --port "$ELASTICACHE_PORT"
    --num-cache-clusters 1
    --no-automatic-failover-enabled
    --no-multi-az-enabled
    --transit-encryption-enabled
    --transit-encryption-mode required
    --at-rest-encryption-enabled
    --auth-token "$ELASTICACHE_AUTH_TOKEN"
    --snapshot-retention-limit "$ELASTICACHE_SNAPSHOT_RETENTION_DAYS"
    --snapshot-window "$ELASTICACHE_SNAPSHOT_WINDOW"
    --tags "$(elasticache_tag_json "$ELASTICACHE_REPLICATION_GROUP_ID")"
  )
  if [[ -n "$ELASTICACHE_ENGINE_VERSION" ]]; then
    create_args+=(--engine-version "$ELASTICACHE_ENGINE_VERSION")
  fi
  aws_region elasticache create-replication-group "${create_args[@]}" >/dev/null
}

modify_replication_group() {
  local current_security_groups current_snapshot_retention current_snapshot_window desired_security_groups
  current_security_groups="$(
    aws_region elasticache describe-replication-groups \
      --replication-group-id "$ELASTICACHE_REPLICATION_GROUP_ID" \
      --query 'sort_by(ReplicationGroups[0].SecurityGroups[].SecurityGroupId, &@)' \
      --output text
  )"
  desired_security_groups="$(printf '%s\n' "$ELASTICACHE_SG_ID" | sort | tr '\n' '\t' | sed 's/[[:space:]]*$//')"
  current_snapshot_retention="$(
    aws_region elasticache describe-replication-groups \
      --replication-group-id "$ELASTICACHE_REPLICATION_GROUP_ID" \
      --query 'ReplicationGroups[0].SnapshotRetentionLimit' \
      --output text
  )"
  current_snapshot_window="$(
    aws_region elasticache describe-replication-groups \
      --replication-group-id "$ELASTICACHE_REPLICATION_GROUP_ID" \
      --query 'ReplicationGroups[0].SnapshotWindow' \
      --output text
  )"

  if [[ "$current_security_groups" == "$desired_security_groups" \
    && "$current_snapshot_retention" == "$ELASTICACHE_SNAPSHOT_RETENTION_DAYS" \
    && "$current_snapshot_window" == "$ELASTICACHE_SNAPSHOT_WINDOW" ]]; then
    log_step "ElastiCache replication group ${ELASTICACHE_REPLICATION_GROUP_ID} already has desired security group and snapshot settings."
    return
  fi

  log_step "Modifying existing ElastiCache replication group ${ELASTICACHE_REPLICATION_GROUP_ID}."
  aws_region elasticache modify-replication-group \
    --replication-group-id "$ELASTICACHE_REPLICATION_GROUP_ID" \
    --security-group-ids "$ELASTICACHE_SG_ID" \
    --snapshot-retention-limit "$ELASTICACHE_SNAPSHOT_RETENTION_DAYS" \
    --snapshot-window "$ELASTICACHE_SNAPSHOT_WINDOW" \
    --apply-immediately >/dev/null
}

authorize_elasticache_ingress_from_ec2() {
  local err_file status
  err_file="$(mktemp)"

  log_step "Authorizing TCP ${ELASTICACHE_PORT} from EC2 security group ${SG_ID} to ElastiCache security group ${ELASTICACHE_SG_ID}."
  set +e
  aws_region ec2 authorize-security-group-ingress \
    --group-id "$ELASTICACHE_SG_ID" \
    --protocol tcp \
    --port "$ELASTICACHE_PORT" \
    --source-group "$SG_ID" >/dev/null 2> "$err_file"
  status=$?
  set -e

  if (( status == 0 )); then
    log_step "Authorized ElastiCache ingress from ${SG_ID}."
    rm -f "$err_file"
    return
  fi

  if grep -q "InvalidPermission.Duplicate" "$err_file"; then
    log_step "ElastiCache ingress from ${SG_ID} already exists."
    rm -f "$err_file"
    return
  fi

  cat "$err_file" >&2
  rm -f "$err_file"
  exit "$status"
}

wait_for_replication_group() {
  local status endpoint elapsed
  elapsed=0
  log_step "Waiting for ElastiCache replication group ${ELASTICACHE_REPLICATION_GROUP_ID} to become available."
  while true; do
    status="$(
      aws_region elasticache describe-replication-groups \
        --replication-group-id "$ELASTICACHE_REPLICATION_GROUP_ID" \
        --query 'ReplicationGroups[0].Status' \
        --output text
    )"
    endpoint="$(
      aws_region elasticache describe-replication-groups \
        --replication-group-id "$ELASTICACHE_REPLICATION_GROUP_ID" \
        --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' \
        --output text 2>/dev/null || true
    )"
    log_step "ElastiCache status=${status}; endpoint=${endpoint:-pending}; elapsed=${elapsed}s."

    case "$status" in
      available)
        return
        ;;
      create-failed|deleting)
        echo "ElastiCache replication group ${ELASTICACHE_REPLICATION_GROUP_ID} reached terminal status: ${status}" >&2
        exit 1
        ;;
    esac

    sleep "$ELASTICACHE_WAIT_POLL_SECONDS"
    elapsed=$((elapsed + ELASTICACHE_WAIT_POLL_SECONDS))
  done
}

primary_endpoint() {
  aws_region elasticache describe-replication-groups \
    --replication-group-id "$ELASTICACHE_REPLICATION_GROUP_ID" \
    --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' \
    --output text
}

replication_group_arn() {
  aws_region elasticache describe-replication-groups \
    --replication-group-id "$ELASTICACHE_REPLICATION_GROUP_ID" \
    --query 'ReplicationGroups[0].ARN' \
    --output text
}

redis_url() {
  local endpoint="$1"
  printf 'rediss://:%s@%s:%s/0?ssl_cert_reqs=required' \
    "$(uri_escape "$ELASTICACHE_AUTH_TOKEN")" "$endpoint" "$ELASTICACHE_PORT"
}

update_secret_drafts() {
  local url="$1"
  if [[ ! -d "$EXAMPLE_SECRETS_DIR" ]]; then
    EXAMPLE_SECRETS_DIR="${REPO_ROOT}/infra/aws/push-secrets/example-secrets"
  fi
  log_step "Ensuring local secret drafts in ${SECRET_DRAFT_DIR}."
  ensure_secret_drafts
  log_step "Writing ElastiCache REDIS_URL to prod API/workers secret drafts."
  set_secret_draft_value prod-api.json REDIS_URL "$url"
  set_secret_draft_value prod-workers.json REDIS_URL "$url"
}

print_report() {
  local report_file="$1"
  cat > "$report_file" <<EOF
Dokumen AWS ElastiCache resources
Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')

AWS_REGION=${AWS_REGION}
PROJECT_NAME=${PROJECT_NAME}
ENVIRONMENT=${ENVIRONMENT}
ACCOUNT_ID=${ACCOUNT_ID}

ElastiCache replication group: ${ELASTICACHE_REPLICATION_GROUP_ID}
ElastiCache endpoint: ${ELASTICACHE_PRIMARY_ENDPOINT}
ElastiCache security group: ${ELASTICACHE_SG_ID}
ElastiCache subnet group: ${ELASTICACHE_SUBNET_GROUP_NAME}
ElastiCache snapshot retention days: ${ELASTICACHE_SNAPSHOT_RETENTION_DAYS}

Sensitive ElastiCache URL and API/workers auth token outputs:
${ELASTICACHE_ENV_FILE}

Secret drafts updated with production REDIS_URL values:
${SECRET_DRAFT_DIR}

Review and push prod/api and prod/workers secrets after this script completes.
EOF
}

echo "Setting up ElastiCache for ${PROJECT_NAME} in ${AWS_REGION}"
validate_auth_token
log_step "Output directory: ${OUTPUT_DIR}"
log_step "Secret draft directory: ${SECRET_DRAFT_DIR}"
log_step "Example secrets directory: ${EXAMPLE_SECRETS_DIR}"
ELASTICACHE_ENV_FILE="${OUTPUT_DIR}/elasticache-resources.env"
ELASTICACHE_REPORT_FILE="${OUTPUT_DIR}/elasticache-report.txt"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
write_env_output "$ELASTICACHE_ENV_FILE" \
  AWS_REGION PROJECT_NAME ENVIRONMENT ACCOUNT_ID \
  VPC_ID PRIVATE_SUBNET_ID PRIVATE_SUBNET_2_ID SG_ID \
  ELASTICACHE_REPLICATION_GROUP_ID ELASTICACHE_SUBNET_GROUP_NAME ELASTICACHE_SG_NAME \
  ELASTICACHE_ENGINE ELASTICACHE_ENGINE_VERSION ELASTICACHE_NODE_TYPE ELASTICACHE_PORT \
  ELASTICACHE_SNAPSHOT_RETENTION_DAYS ELASTICACHE_SNAPSHOT_WINDOW SECRET_DRAFT_DIR
log_step "Wrote initial resource output: ${ELASTICACHE_ENV_FILE}"
REPLICATION_GROUP_EXISTS=0
if replication_group_exists; then
  REPLICATION_GROUP_EXISTS=1
  assert_existing_auth_token_confirmed
fi

ensure_cache_subnet_group
log_step "Ensuring ElastiCache security group ${ELASTICACHE_SG_NAME} in VPC ${VPC_ID}."
ELASTICACHE_SG_ID="$(ensure_security_group "$ELASTICACHE_SG_NAME" "Dokumen production ElastiCache Redis" "$VPC_ID")"
authorize_elasticache_ingress_from_ec2
write_env_output "$ELASTICACHE_ENV_FILE" \
  AWS_REGION PROJECT_NAME ENVIRONMENT ACCOUNT_ID \
  VPC_ID PRIVATE_SUBNET_ID PRIVATE_SUBNET_2_ID SG_ID \
  ELASTICACHE_REPLICATION_GROUP_ID ELASTICACHE_SUBNET_GROUP_NAME ELASTICACHE_SG_NAME ELASTICACHE_SG_ID \
  ELASTICACHE_ENGINE ELASTICACHE_ENGINE_VERSION ELASTICACHE_NODE_TYPE ELASTICACHE_PORT \
  ELASTICACHE_SNAPSHOT_RETENTION_DAYS ELASTICACHE_SNAPSHOT_WINDOW SECRET_DRAFT_DIR
log_step "Updated resource output with ElastiCache security group: ${ELASTICACHE_ENV_FILE}"

if [[ "$REPLICATION_GROUP_EXISTS" == "1" ]]; then
  modify_replication_group
else
  create_replication_group
fi
wait_for_replication_group

ELASTICACHE_PRIMARY_ENDPOINT="$(primary_endpoint)"
ELASTICACHE_REPLICATION_GROUP_ARN="$(replication_group_arn)"
set_elasticache_tags "$ELASTICACHE_REPLICATION_GROUP_ID"
log_step "Tagging ElastiCache replication group ${ELASTICACHE_REPLICATION_GROUP_ID}."
aws_region elasticache add-tags-to-resource \
  --resource-name "$ELASTICACHE_REPLICATION_GROUP_ARN" \
  --tags "${ELASTICACHE_TAGS[@]}" >/dev/null
REDIS_URL="$(redis_url "$ELASTICACHE_PRIMARY_ENDPOINT")"
# shellcheck disable=SC2034
DOKUMEN_REDIS_ELASTICACHE_URL="$REDIS_URL"
# shellcheck disable=SC2034
API_REDIS_URL="$REDIS_URL"
# shellcheck disable=SC2034
WORKERS_REDIS_URL="$REDIS_URL"
# shellcheck disable=SC2034
API_ELASTICACHE_AUTH_TOKEN="$ELASTICACHE_AUTH_TOKEN"
# shellcheck disable=SC2034
WORKERS_ELASTICACHE_AUTH_TOKEN="$ELASTICACHE_AUTH_TOKEN"
update_secret_drafts "$REDIS_URL"

write_env_output "$ELASTICACHE_ENV_FILE" \
  AWS_REGION PROJECT_NAME ENVIRONMENT ACCOUNT_ID \
  VPC_ID PRIVATE_SUBNET_ID PRIVATE_SUBNET_2_ID SG_ID \
  ELASTICACHE_REPLICATION_GROUP_ID ELASTICACHE_PRIMARY_ENDPOINT ELASTICACHE_REPLICATION_GROUP_ARN \
  ELASTICACHE_SUBNET_GROUP_NAME ELASTICACHE_SG_ID ELASTICACHE_ENGINE ELASTICACHE_ENGINE_VERSION \
  ELASTICACHE_NODE_TYPE ELASTICACHE_PORT ELASTICACHE_SNAPSHOT_RETENTION_DAYS ELASTICACHE_SNAPSHOT_WINDOW \
  DOKUMEN_REDIS_ELASTICACHE_URL API_REDIS_URL WORKERS_REDIS_URL \
  API_ELASTICACHE_AUTH_TOKEN WORKERS_ELASTICACHE_AUTH_TOKEN SECRET_DRAFT_DIR
print_report "$ELASTICACHE_REPORT_FILE"
chmod 600 "$ELASTICACHE_REPORT_FILE" 2>/dev/null || true

echo "ElastiCache setup complete."
echo "Resource output: $ELASTICACHE_ENV_FILE"
echo "Report: $ELASTICACHE_REPORT_FILE"
