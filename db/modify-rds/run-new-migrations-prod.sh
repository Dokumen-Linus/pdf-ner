#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=db/modify-rds/lib.sh
. "${SCRIPT_DIR}/lib.sh"

if [ "$#" -ne 0 ]; then
  echo "Usage: bash db/modify-rds/run-new-migrations-prod.sh" >&2
  exit 1
fi

configure_modify_rds_paths
load_modify_rds_env production
configure_modify_rds_db_defaults
configure_prod_remote_defaults

require_cmd aws
require_cmd base64
require_cmd tar
require_no_duplicate_migration_versions
resolve_prod_instance_id

migrations_payload="$(tar -C "$DB_DIR" -czf - migrations | base64 | tr -d '\n')"
remote_env="$(remote_env_prefix)"

read -r -d '' remote_command <<EOF || true
${remote_env}
export PGPASSWORD PGSSLMODE
command -v psql >/dev/null 2>&1 || { echo "ERROR: psql is required on the EC2 host." >&2; exit 1; }
command -v dbmate >/dev/null 2>&1 || { echo "ERROR: dbmate is required on the EC2 host." >&2; exit 1; }
work_dir="\$(mktemp -d)"
cleanup() {
  rm -rf "\$work_dir"
}
trap cleanup EXIT
base64 --decode > "\$work_dir/migrations.tar.gz" <<'MIGRATIONS_PAYLOAD'
${migrations_payload}
MIGRATIONS_PAYLOAD
tar -xzf "\$work_dir/migrations.tar.gz" -C "\$work_dir"
applied_migration_count="\$(
  psql -v ON_ERROR_STOP=1 \
    --host "\$RDS_HOST" \
    --port "\$RDS_PORT" \
    --username "\$RDS_ADMIN_USER" \
    --dbname "\$RDS_DB" \
    --tuples-only \
    --no-align \
    --command "\$(cat <<'SQL'
SELECT CASE
  WHEN to_regclass('public.schema_migrations') IS NULL THEN -1
  ELSE (SELECT count(*) FROM public.schema_migrations)
END;
SQL
    )"
)"
if [ "\$applied_migration_count" = "-1" ]; then
  echo "ERROR: \$RDS_DB does not have public.schema_migrations. Run full bootstrap before modifying RDS." >&2
  exit 1
fi
if [ "\$applied_migration_count" = "0" ]; then
  echo "ERROR: \$RDS_DB has public.schema_migrations but no applied migrations. Refusing modify-only operation." >&2
  exit 1
fi
echo "Checking \$RDS_ADMIN_USER can SET ROLE owner_role on production RDS \$RDS_HOST:\$RDS_PORT/\$RDS_DB..."
psql -v ON_ERROR_STOP=1 \
  --host "\$RDS_HOST" \
  --port "\$RDS_PORT" \
  --username "\$RDS_ADMIN_USER" \
  --dbname "\$RDS_DB" \
  --command "SET ROLE owner_role; SELECT current_user;" >/dev/null
echo "Running dbmate migrations against production RDS \$RDS_HOST:\$RDS_PORT/\$RDS_DB..."
DATABASE_URL="postgres://\${RDS_ADMIN_USER}@\${RDS_HOST}:\${RDS_PORT}/\${RDS_DB}?sslmode=\${PGSSLMODE}&options=-c%20role%3Downer_role" \
  dbmate --migrations-dir="\$work_dir/migrations" up
EOF

run_prod_remote_or_fallback "run production dbmate migrations" "$remote_command"
