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
  PROD_LOCAL_RDS_PORT="${PROD_LOCAL_RDS_PORT:-15432}"
  PORT_FORWARD_READY_TIMEOUT_SECONDS="${PORT_FORWARD_READY_TIMEOUT_SECONDS:-30}"
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

resolve_prod_public_ip() {
  aws_region ec2 describe-instances \
    --instance-ids "$EC2_INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text
}

wait_for_local_port_forward() {
  local label="$1"
  local started_pid="$2"
  local log_file="$3"
  local elapsed_seconds=0

  while [ "$elapsed_seconds" -lt "$PORT_FORWARD_READY_TIMEOUT_SECONDS" ]; do
    if nc -z 127.0.0.1 "$PROD_LOCAL_RDS_PORT" >/dev/null 2>&1; then
      echo "${label} is listening on 127.0.0.1:${PROD_LOCAL_RDS_PORT}"
      return 0
    fi

    if ! kill -0 "$started_pid" >/dev/null 2>&1; then
      echo "${label} exited before the local port opened." >&2
      sed -n '1,120p' "$log_file" >&2
      return 1
    fi

    sleep 1
    elapsed_seconds=$((elapsed_seconds + 1))
  done

  echo "${label} did not open 127.0.0.1:${PROD_LOCAL_RDS_PORT} within ${PORT_FORWARD_READY_TIMEOUT_SECONDS}s." >&2
  sed -n '1,120p' "$log_file" >&2
  return 1
}

stop_prod_port_forward() {
  if [ -n "${PORT_FORWARD_PID:-}" ] && kill -0 "$PORT_FORWARD_PID" >/dev/null 2>&1; then
    kill "$PORT_FORWARD_PID" >/dev/null 2>&1 || true
    wait "$PORT_FORWARD_PID" >/dev/null 2>&1 || true
  fi

  if [ -n "${PORT_FORWARD_LOG:-}" ]; then
    rm -f "$PORT_FORWARD_LOG"
  fi
}

start_prod_ssm_port_forward() {
  PORT_FORWARD_LOG="$(mktemp)"
  echo "Opening SSM port forward through ${EC2_INSTANCE_ID}: 127.0.0.1:${PROD_LOCAL_RDS_PORT} -> ${RDS_HOST}:${RDS_PORT}"

  aws_region ssm start-session \
    --target "$EC2_INSTANCE_ID" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters "host=${RDS_HOST},portNumber=${RDS_PORT},localPortNumber=${PROD_LOCAL_RDS_PORT}" \
    >"$PORT_FORWARD_LOG" 2>&1 &
  PORT_FORWARD_PID=$!

  wait_for_local_port_forward "SSM port forward" "$PORT_FORWARD_PID" "$PORT_FORWARD_LOG"
}

start_prod_ssh_port_forward() {
  local public_ip ssh_target

  public_ip="$(resolve_prod_public_ip)"
  if [ -z "$public_ip" ] || [ "$public_ip" = "None" ]; then
    echo "Instance ${EC2_INSTANCE_ID} has no public IP for SSH fallback." >&2
    exit 1
  fi

  ssh_target="${SSH_USER}@${public_ip}"
  PORT_FORWARD_LOG="$(mktemp)"
  echo "Opening SSH port forward through ${ssh_target}: 127.0.0.1:${PROD_LOCAL_RDS_PORT} -> ${RDS_HOST}:${RDS_PORT}"
  ssh \
    -N \
    -L "${PROD_LOCAL_RDS_PORT}:${RDS_HOST}:${RDS_PORT}" \
    -i "$SSH_PRIVATE_KEY_PATH" \
    -o StrictHostKeyChecking=accept-new \
    "$ssh_target" \
    >"$PORT_FORWARD_LOG" 2>&1 &
  PORT_FORWARD_PID=$!

  wait_for_local_port_forward "SSH port forward" "$PORT_FORWARD_PID" "$PORT_FORWARD_LOG"
}

start_prod_port_forward() {
  trap stop_prod_port_forward EXIT

  if start_prod_ssm_port_forward; then
    RDS_HOST=127.0.0.1
    RDS_PORT="$PROD_LOCAL_RDS_PORT"
    return
  fi

  if [ "$USE_SSH_FALLBACK" = "1" ]; then
    echo "SSM port forwarding failed; retrying through explicit SSH fallback."
    stop_prod_port_forward
    start_prod_ssh_port_forward
    RDS_HOST=127.0.0.1
    RDS_PORT="$PROD_LOCAL_RDS_PORT"
    return
  fi

  echo "SSM port forwarding failed. Set USE_SSH_FALLBACK=1 only if SSM is unavailable and SSH is necessary." >&2
  exit 1
}
