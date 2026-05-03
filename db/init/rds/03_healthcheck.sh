#!/usr/bin/env bash
set -euo pipefail

: "${RDS_HOST:?RDS_HOST is required}"
: "${OWNER_ROLE_PASSWORD:?OWNER_ROLE_PASSWORD is required}"
: "${AUTH_ROLE_PASSWORD:?AUTH_ROLE_PASSWORD is required}"
: "${WEB_USER_PASSWORD:?WEB_USER_PASSWORD is required}"
: "${API_USER_PASSWORD:?API_USER_PASSWORD is required}"
: "${WORKERS_USER_PASSWORD:?WORKERS_USER_PASSWORD is required}"

RDS_PORT="${RDS_PORT:-5432}"
RDS_DB="${RDS_DB:-dokumen}"
PGSSLMODE="${PGSSLMODE:-require}"
export PGSSLMODE

run_sql() {
  local user="$1"
  local password="$2"
  local sql="$3"
  PGPASSWORD="$password" psql -v ON_ERROR_STOP=1 \
    --host "$RDS_HOST" \
    --port "$RDS_PORT" \
    --username "$user" \
    --dbname "$RDS_DB" \
    --tuples-only \
    --no-align \
    --command "$sql"
}

expect_true() {
  local user="$1"
  local password="$2"
  local label="$3"
  local sql="$4"
  local result
  result="$(run_sql "$user" "$password" "$sql")"
  if [[ "$result" != "t" ]]; then
    echo "ERROR: ${label} failed for ${user}" >&2
    exit 1
  fi
}

check_table() {
  local user="$1"
  local password="$2"
  local table="$3"
  expect_true "$user" "$password" "$table visible" "SELECT to_regclass('${table}') IS NOT NULL;"
}

echo "Checking RDS role connectivity and schema visibility..."

check_table "auth_role" "$AUTH_ROLE_PASSWORD" "auth.\"user\""

check_table "web_user" "$WEB_USER_PASSWORD" "auth.\"user\""
check_table "web_user" "$WEB_USER_PASSWORD" "web.users"
check_table "web_user" "$WEB_USER_PASSWORD" "web.projects"
check_table "web_user" "$WEB_USER_PASSWORD" "web.pdfs"

check_table "api_user" "$API_USER_PASSWORD" "api.aws_buckets"
check_table "api_user" "$API_USER_PASSWORD" "api.pdfs"
check_table "api_user" "$API_USER_PASSWORD" "api.prompts"
expect_true "api_user" "$API_USER_PASSWORD" "workers.llm_usage insert privilege" \
  "SELECT has_table_privilege(current_user, 'workers.llm_usage', 'INSERT');"

check_table "workers_user" "$WORKERS_USER_PASSWORD" "workers.pdfs"
check_table "workers_user" "$WORKERS_USER_PASSWORD" "workers.llm_usage"
check_table "workers_user" "$WORKERS_USER_PASSWORD" "workers.billing_charge_attempts"
check_table "workers_user" "$WORKERS_USER_PASSWORD" "workers.ocr_evaluation_runs"

check_table "owner_role" "$OWNER_ROLE_PASSWORD" "public.models"

echo "RDS health checks passed."
