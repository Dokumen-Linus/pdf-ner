#!/usr/bin/env bash

configure_modify_rds_paths() {
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  DB_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
  REPO_ROOT="$(cd "${DB_DIR}/.." && pwd)"
}

load_modify_rds_env() {
  local target="$1"
  local default_env_file

  case "$target" in
    development)
      if [ -f "${SCRIPT_DIR}/.env.development" ]; then
        default_env_file="${SCRIPT_DIR}/.env.development"
      else
        default_env_file="${DB_DIR}/deploy-rds/.env.development"
      fi
      ;;
    production)
      if [ -f "${SCRIPT_DIR}/.env.production" ]; then
        default_env_file="${SCRIPT_DIR}/.env.production"
      else
        default_env_file="${DB_DIR}/deploy-rds/.env.production"
      fi
      ;;
    *)
      echo "Unknown modify-rds target: ${target}" >&2
      exit 1
      ;;
  esac

  ENV_FILE="${RDS_DEPLOY_ENV_FILE:-${default_env_file}}"

  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
}

configure_modify_rds_db_defaults() {
  : "${RDS_HOST:?RDS_HOST is required in ${ENV_FILE}}"
  : "${RDS_ADMIN_USER:?RDS_ADMIN_USER is required in ${ENV_FILE}}"
  : "${PGPASSWORD:?PGPASSWORD must contain the RDS admin password from ${ENV_FILE}}"

  RDS_PORT="${RDS_PORT:-5432}"
  RDS_DB="${RDS_DB:-dokumen}"
  PGSSLMODE="${PGSSLMODE:-require}"
  export PGPASSWORD PGSSLMODE
}

require_cmd() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Required command not found: ${name}" >&2
    exit 1
  fi
}

require_no_duplicate_migration_versions() {
  local duplicate_migration_versions migration_file migration_name migration_version

  duplicate_migration_versions="$(
    for migration_file in "${DB_DIR}"/migrations/*.sql; do
      migration_name="$(basename "$migration_file")"
      migration_version="${migration_name%%_*}"
      printf '%s\n' "$migration_version"
    done | sort | uniq -d
  )"

  if [ -n "$duplicate_migration_versions" ]; then
    echo "ERROR: duplicate dbmate migration version prefix found:" >&2
    printf '%s\n' "$duplicate_migration_versions" >&2
    echo "Migration filenames must start with a unique numeric prefix before the first underscore." >&2
    exit 1
  fi
}

check_dbmate_history_sql() {
  cat <<'SQL'
SELECT CASE
  WHEN to_regclass('public.schema_migrations') IS NULL THEN -1
  ELSE (SELECT count(*) FROM public.schema_migrations)
END;
SQL
}

assert_applied_migration_count() {
  local applied_migration_count="$1"

  if [ "$applied_migration_count" = "-1" ]; then
    echo "ERROR: ${RDS_DB} does not have public.schema_migrations. Run full bootstrap before modifying RDS." >&2
    exit 1
  fi

  if [ "$applied_migration_count" = "0" ]; then
    echo "ERROR: ${RDS_DB} has public.schema_migrations but no applied migrations. Refusing modify-only operation." >&2
    exit 1
  fi
}

assert_local_dbmate_history() {
  local target="$1"
  local applied_migration_count

  echo "Checking ${target} RDS database exists and has dbmate history..."
  applied_migration_count="$(
    psql -v ON_ERROR_STOP=1 \
      --host "$RDS_HOST" \
      --port "$RDS_PORT" \
      --username "$RDS_ADMIN_USER" \
      --dbname "$RDS_DB" \
      --tuples-only \
      --no-align \
      --command "$(check_dbmate_history_sql)"
  )"
  assert_applied_migration_count "$applied_migration_count"
}

assert_seed_file_arg() {
  local seed_file_arg="$1"

  case "$seed_file_arg" in
    db/seeds/*.sql)
      SEED_FILE="${REPO_ROOT}/${seed_file_arg}"
      ;;
    *)
      echo "Usage: bash db/modify-rds/run-new-seeds-dev.sh db/seeds/path/to-seed.sql" >&2
      echo "Seed file must be a .sql file under db/seeds." >&2
      exit 1
      ;;
  esac

  if [ ! -f "$SEED_FILE" ]; then
    echo "Seed file not found: ${seed_file_arg}" >&2
    exit 1
  fi
}

configure_prod_remote_defaults() {
  PROJECT_NAME="${PROJECT_NAME:-dokumen}"
  ENVIRONMENT="${ENVIRONMENT:-production}"
  AWS_REGION="${AWS_REGION:-us-east-1}"
  INSTANCE_NAME="${INSTANCE_NAME:-${PROJECT_NAME}-ec2}"
  EC2_INSTANCE_ID="${EC2_INSTANCE_ID:-${INSTANCE_ID:-}}"
  EC2_APP_DIR="${EC2_APP_DIR:-/opt/dokumen/pdf-ner}"
  USE_SSH_FALLBACK="${USE_SSH_FALLBACK:-0}"
  SSH_PRIVATE_KEY_PATH="${SSH_PRIVATE_KEY_PATH:-${HOME}/.ssh/dokumen-ec2}"
  SSH_USER="${SSH_USER:-ec2-user}"
}

aws_region() {
  aws --region "$AWS_REGION" "$@"
}

resolve_prod_instance_id() {
  if [ -n "$EC2_INSTANCE_ID" ]; then
    return
  fi

  EC2_INSTANCE_ID="$(
    aws_region ec2 describe-instances \
      --filters "Name=tag:Name,Values=${INSTANCE_NAME}" "Name=instance-state-name,Values=running" \
      --query 'Reservations[].Instances[].InstanceId | [0]' \
      --output text
  )"

  if [ -z "$EC2_INSTANCE_ID" ] || [ "$EC2_INSTANCE_ID" = "None" ]; then
    echo "Could not find a running EC2 instance tagged Name=${INSTANCE_NAME}. Set EC2_INSTANCE_ID and retry." >&2
    exit 1
  fi
}

shell_quote() {
  printf '%q' "$1"
}

remote_env_prefix() {
  printf 'RDS_HOST=%s RDS_PORT=%s RDS_DB=%s RDS_ADMIN_USER=%s PGPASSWORD=%s PGSSLMODE=%s' \
    "$(shell_quote "$RDS_HOST")" \
    "$(shell_quote "$RDS_PORT")" \
    "$(shell_quote "$RDS_DB")" \
    "$(shell_quote "$RDS_ADMIN_USER")" \
    "$(shell_quote "$PGPASSWORD")" \
    "$(shell_quote "$PGSSLMODE")"
}

run_prod_ssm_command() {
  local label="$1"
  local remote_command="$2"
  local command_id encoded_command send_status wait_status wrapped_command

  echo "Running on production EC2 through SSM: ${label}"
  remote_command=$'set -euo pipefail\n'"$remote_command"
  encoded_command="$(printf '%s' "$remote_command" | base64 | tr -d '\n')"
  wrapped_command="printf %s ${encoded_command} | base64 --decode | bash -s"

  set +e
  command_id="$(
    aws_region ssm send-command \
      --instance-ids "$EC2_INSTANCE_ID" \
      --document-name "AWS-RunShellScript" \
      --comment "modify-rds: ${label}" \
      --parameters "commands=${wrapped_command}" \
      --query "Command.CommandId" \
      --output text
  )"
  send_status=$?
  set -e

  if [ "$send_status" -ne 0 ]; then
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

resolve_prod_public_ip() {
  aws_region ec2 describe-instances \
    --instance-ids "$EC2_INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text
}

run_prod_ssh_command() {
  local remote_command="$1"
  local public_ip ssh_target

  public_ip="$(resolve_prod_public_ip)"
  if [ -z "$public_ip" ] || [ "$public_ip" = "None" ]; then
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

run_prod_remote_or_fallback() {
  local label="$1"
  local remote_command="$2"

  if run_prod_ssm_command "$label" "$remote_command"; then
    return
  fi

  if [ "$USE_SSH_FALLBACK" = "1" ]; then
    echo "SSM ${label} failed; retrying through explicit SSH fallback."
    run_prod_ssh_command "$remote_command"
    return
  fi

  echo "SSM ${label} failed. Set USE_SSH_FALLBACK=1 only if SSM is unavailable and SSH is necessary." >&2
  exit 1
}
