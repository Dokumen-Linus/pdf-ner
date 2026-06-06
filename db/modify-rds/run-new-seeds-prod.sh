#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=db/modify-rds/lib.sh
. "${SCRIPT_DIR}/lib.sh"

if [ "$#" -ne 1 ]; then
  echo "Usage: bash db/modify-rds/run-new-seeds-prod.sh db/seeds/path/to-seed.sql" >&2
  exit 1
fi

SEED_FILE_ARG="$1"

configure_modify_rds_paths
assert_seed_file_arg "$SEED_FILE_ARG"
load_modify_rds_env production
configure_modify_rds_db_defaults
configure_prod_remote_defaults

require_cmd aws
require_cmd base64
resolve_prod_instance_id

seed_payload="$(base64 < "$SEED_FILE" | tr -d '\n')"
remote_env="$(remote_env_prefix)"

read -r -d '' remote_command <<EOF || true
${remote_env}
export PGPASSWORD PGSSLMODE
command -v psql >/dev/null 2>&1 || { echo "ERROR: psql is required on the EC2 host." >&2; exit 1; }
work_dir="\$(mktemp -d)"
cleanup() {
  rm -rf "\$work_dir"
}
trap cleanup EXIT
seed_file="\$work_dir/seed.sql"
base64 --decode > "\$seed_file" <<'SEED_PAYLOAD'
${seed_payload}
SEED_PAYLOAD
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
  echo "ERROR: \$RDS_DB does not have public.schema_migrations. Run full bootstrap before running extra seeds." >&2
  exit 1
fi
if [ "\$applied_migration_count" = "0" ]; then
  echo "ERROR: \$RDS_DB has public.schema_migrations but no applied migrations. Refusing to run seeds before migrations." >&2
  exit 1
fi
echo "Running seed ${SEED_FILE_ARG} against production RDS \$RDS_HOST:\$RDS_PORT/\$RDS_DB..."
psql -v ON_ERROR_STOP=1 \
  --host "\$RDS_HOST" \
  --port "\$RDS_PORT" \
  --username "\$RDS_ADMIN_USER" \
  --dbname "\$RDS_DB" \
  -f "\$seed_file"
EOF

run_prod_remote_or_fallback "run production seed ${SEED_FILE_ARG}" "$remote_command"
