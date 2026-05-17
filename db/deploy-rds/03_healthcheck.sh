#!/usr/bin/env bash
set -euo pipefail

: "${RDS_HOST:?RDS_HOST is required}"
: "${RDS_ADMIN_USER:?RDS_ADMIN_USER is required}"
: "${PGPASSWORD:?PGPASSWORD must contain the RDS admin password}"
: "${OWNER_ROLE_PASSWORD:?OWNER_ROLE_PASSWORD is required}"
: "${AUTH_ROLE_PASSWORD:?AUTH_ROLE_PASSWORD is required}"
: "${WEB_USER_PASSWORD:?WEB_USER_PASSWORD is required}"
: "${API_USER_PASSWORD:?API_USER_PASSWORD is required}"
: "${WORKERS_USER_PASSWORD:?WORKERS_USER_PASSWORD is required}"

RDS_PORT="${RDS_PORT:-5432}"
RDS_DB="${RDS_DB:-dokumen}"
PGSSLMODE="${PGSSLMODE:-require}"
export PGSSLMODE

run_sql_as_admin_role() {
  local role="$1"
  local sql="$2"
  PGPASSWORD="$PGPASSWORD" psql -v ON_ERROR_STOP=1 \
    --quiet \
    --host "$RDS_HOST" \
    --port "$RDS_PORT" \
    --username "$RDS_ADMIN_USER" \
    --dbname "$RDS_DB" \
    --tuples-only \
    --no-align \
    --command "SET ROLE ${role}; ${sql}"
}

run_sql_direct() {
  local role="$1"
  local password="$2"
  local sql="$3"
  PGPASSWORD="$password" psql -v ON_ERROR_STOP=1 \
    --quiet \
    --host "$RDS_HOST" \
    --port "$RDS_PORT" \
    --username "$role" \
    --dbname "$RDS_DB" \
    --tuples-only \
    --no-align \
    --command "$sql"
}

password_for_role() {
  local role="$1"
  case "$role" in
    owner_role) printf '%s' "$OWNER_ROLE_PASSWORD" ;;
    auth_role) printf '%s' "$AUTH_ROLE_PASSWORD" ;;
    web_user) printf '%s' "$WEB_USER_PASSWORD" ;;
    api_user) printf '%s' "$API_USER_PASSWORD" ;;
    workers_user) printf '%s' "$WORKERS_USER_PASSWORD" ;;
    *)
      echo "ERROR: no password mapping for role ${role}" >&2
      exit 1
      ;;
  esac
}

expect_true() {
  local role="$1"
  local label="$2"
  local sql="$3"
  local result
  result="$(run_sql_admin_or_direct "$role" "$sql")"
  if [[ "$result" != "t" ]]; then
    echo "ERROR: ${label} failed for ${role}" >&2
    exit 1
  fi
}

run_sql_admin_or_direct() {
  local role="$1"
  local sql="$2"
  local password
  password="$(password_for_role "$role")"
  run_sql_direct "$role" "$password" "$sql"
}

check_table() {
  local role="$1"
  local table="$2"
  expect_true "$role" "$table visible" "SELECT to_regclass('${table}') IS NOT NULL;"
}

echo "Checking RDS role grants via ${RDS_ADMIN_USER} SET ROLE..."
admin_result="$(run_sql_as_admin_role owner_role "SELECT current_user = 'owner_role';")"
if [[ "$admin_result" != "t" ]]; then
  echo "ERROR: ${RDS_ADMIN_USER} cannot SET ROLE owner_role" >&2
  exit 1
fi

echo "Checking direct password connections for app roles..."

check_table "auth_role" "auth.\"user\""

check_table "web_user" "auth.\"user\""
check_table "web_user" "web.users"
check_table "web_user" "web.projects"
check_table "web_user" "web.pdfs"

check_table "api_user" "api.aws_buckets"
check_table "api_user" "core.prompts"
expect_true "api_user" "workers.llm_usage insert privilege" \
  "SELECT has_table_privilege(current_user, 'workers.llm_usage', 'INSERT');"

check_table "workers_user" "core.pdfs"
check_table "workers_user" "workers.llm_usage"
check_table "workers_user" "workers.billing_charge_attempts"
check_table "workers_user" "workers.ocr_evaluation_runs"

check_table "owner_role" "public.chat_models"

echo "RDS health checks passed."
