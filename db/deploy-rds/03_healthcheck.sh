#!/usr/bin/env bash
set -euo pipefail

: "${RDS_HOST:?RDS_HOST is required}"
: "${RDS_ADMIN_USER:?RDS_ADMIN_USER is required}"
: "${PGPASSWORD:?PGPASSWORD must contain the RDS admin password}"

RDS_PORT="${RDS_PORT:-5432}"
RDS_DB="${RDS_DB:-dokumen}"
PGSSLMODE="${PGSSLMODE:-require}"
export PGPASSWORD PGSSLMODE

run_sql_as_role() {
  local role="$1"
  local sql="$2"
  psql -v ON_ERROR_STOP=1 \
    --quiet \
    --host "$RDS_HOST" \
    --port "$RDS_PORT" \
    --username "$RDS_ADMIN_USER" \
    --dbname "$RDS_DB" \
    --tuples-only \
    --no-align \
    --command "SET ROLE ${role}; ${sql}"
}

expect_true() {
  local role="$1"
  local label="$2"
  local sql="$3"
  local result
  result="$(run_sql_as_role "$role" "$sql")"
  if [[ "$result" != "t" ]]; then
    echo "ERROR: ${label} failed for ${role}" >&2
    exit 1
  fi
}

check_table() {
  local role="$1"
  local table="$2"
  expect_true "$role" "$table visible" "SELECT to_regclass('${table}') IS NOT NULL;"
}

echo "Checking RDS role grants and schema visibility via ${RDS_ADMIN_USER} SET ROLE..."

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
