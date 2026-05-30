#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/aws/shared/common.sh
. "${SCRIPT_DIR}/../shared/common.sh"

load_env_file "${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
configure_common_defaults

declare VPC_ID
declare PRIVATE_SUBNET_ID
declare PRIVATE_SUBNET_2_ID
declare SG_ID
declare PROD_RDS_IDENTIFIER
declare PROD_RDS_SUBNET_GROUP_NAME
declare PROD_RDS_SG_NAME
declare PROD_RDS_MASTER_PASSWORD
declare PROD_RDS_MULTI_AZ
declare DEV_VPC_ID
declare DEV_SUBNET_1_ID
declare DEV_SUBNET_2_ID
declare DEV_RDS_IDENTIFIER
declare DEV_RDS_SUBNET_GROUP_NAME
declare DEV_RDS_SG_NAME
declare DEV_RDS_MASTER_PASSWORD
declare RDS_ENGINE
declare RDS_ENGINE_VERSION
declare RDS_INSTANCE_CLASS
declare RDS_ALLOCATED_STORAGE
declare RDS_STORAGE_TYPE
declare RDS_DB_NAME
declare RDS_MASTER_USERNAME
declare RDS_BACKUP_RETENTION_DAYS
declare RDS_DELETION_PROTECTION
declare RDS_PORT
declare AUTH_ROLE_PASSWORD
declare WEB_USER_PASSWORD
declare API_USER_PASSWORD
declare WORKERS_USER_PASSWORD

: "${VPC_ID}"
: "${PRIVATE_SUBNET_ID}"
: "${PRIVATE_SUBNET_2_ID}"
: "${SG_ID}"
: "${PROD_RDS_IDENTIFIER}"
: "${PROD_RDS_SUBNET_GROUP_NAME}"
: "${PROD_RDS_SG_NAME}"
: "${PROD_RDS_MASTER_PASSWORD}"
: "${PROD_RDS_MULTI_AZ}"
: "${DEV_VPC_ID}"
: "${DEV_SUBNET_1_ID}"
: "${DEV_SUBNET_2_ID}"
: "${DEV_RDS_IDENTIFIER}"
: "${DEV_RDS_SUBNET_GROUP_NAME}"
: "${DEV_RDS_SG_NAME}"
: "${DEV_RDS_MASTER_PASSWORD}"
: "${RDS_ENGINE}"
: "${RDS_ENGINE_VERSION}"
: "${RDS_INSTANCE_CLASS}"
: "${RDS_ALLOCATED_STORAGE}"
: "${RDS_STORAGE_TYPE}"
: "${RDS_DB_NAME}"
: "${RDS_MASTER_USERNAME}"
: "${RDS_BACKUP_RETENTION_DAYS}"
: "${RDS_DELETION_PROTECTION}"
: "${RDS_PORT}"
: "${AUTH_ROLE_PASSWORD}"
: "${WEB_USER_PASSWORD}"
: "${API_USER_PASSWORD}"
: "${WORKERS_USER_PASSWORD}"

echo "Setting up RDS instances for ${PROJECT_NAME} in ${AWS_REGION}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

RDS_SG_ID="$(ensure_security_group "$PROD_RDS_SG_NAME" "Dokumen production Postgres" "$VPC_ID")"
authorize_tcp_from_sg "$RDS_SG_ID" "$RDS_PORT" "$SG_ID"
authorize_tcp_from_cidr "$RDS_SG_ID" "$RDS_PORT" "$ADMIN_CIDR"
ensure_db_subnet_group \
  "$PROD_RDS_SUBNET_GROUP_NAME" \
  "Dokumen production RDS private subnets" \
  "$PRIVATE_SUBNET_ID" "$PRIVATE_SUBNET_2_ID"
ensure_postgres_rds_instance \
  "$PROD_RDS_IDENTIFIER" \
  "$PROD_RDS_SUBNET_GROUP_NAME" \
  "$RDS_SG_ID" \
  "$PROD_RDS_MASTER_PASSWORD" \
  false \
  "$(bool_flag "$RDS_DELETION_PROTECTION")" \
  "$(bool_flag "$PROD_RDS_MULTI_AZ")"
PROD_RDS_HOST="$(get_rds_endpoint "$PROD_RDS_IDENTIFIER")"

DEV_RDS_SG_ID="$(ensure_security_group "$DEV_RDS_SG_NAME" "Dokumen development Postgres" "$DEV_VPC_ID")"
authorize_tcp_from_cidr "$DEV_RDS_SG_ID" "$RDS_PORT" "$ADMIN_CIDR"
ensure_db_subnet_group \
  "$DEV_RDS_SUBNET_GROUP_NAME" \
  "Dokumen development RDS public subnets" \
  "$DEV_SUBNET_1_ID" "$DEV_SUBNET_2_ID"
ensure_postgres_rds_instance \
  "$DEV_RDS_IDENTIFIER" \
  "$DEV_RDS_SUBNET_GROUP_NAME" \
  "$DEV_RDS_SG_ID" \
  "$DEV_RDS_MASTER_PASSWORD" \
  true \
  "$(bool_flag "$RDS_DELETION_PROTECTION")" \
  false
DEV_RDS_HOST="$(get_rds_endpoint "$DEV_RDS_IDENTIFIER")"

ensure_secret_drafts
set_secret_draft_value prod-web.json DATABASE_URL "$(postgres_url web_user "$WEB_USER_PASSWORD" "$PROD_RDS_HOST" "$RDS_DB_NAME")"
set_secret_draft_value prod-web.json WEB_DATABASE_URL "$(postgres_url web_user "$WEB_USER_PASSWORD" "$PROD_RDS_HOST" "$RDS_DB_NAME")"
set_secret_draft_value prod-web.json AUTH_DATABASE_URL "$(postgres_url auth_role "$AUTH_ROLE_PASSWORD" "$PROD_RDS_HOST" "$RDS_DB_NAME")"
set_secret_draft_value prod-api.json API_DATABASE_URL "$(postgres_url api_user "$API_USER_PASSWORD" "$PROD_RDS_HOST" "$RDS_DB_NAME")"
set_secret_draft_value prod-workers.json WORKERS_DATABASE_URL "$(postgres_url workers_user "$WORKERS_USER_PASSWORD" "$PROD_RDS_HOST" "$RDS_DB_NAME")"

DATABASE_ENV_FILE="${OUTPUT_DIR}/database-resources.env"
DATABASE_REPORT_FILE="${OUTPUT_DIR}/database-report.txt"
write_env_output "$DATABASE_ENV_FILE" \
  AWS_REGION PROJECT_NAME ACCOUNT_ID ADMIN_CIDR \
  VPC_ID PRIVATE_SUBNET_ID PRIVATE_SUBNET_2_ID SG_ID RDS_SG_ID PROD_RDS_HOST \
  DEV_VPC_ID DEV_SUBNET_1_ID DEV_SUBNET_2_ID DEV_RDS_SG_ID DEV_RDS_HOST \
  PROD_RDS_IDENTIFIER DEV_RDS_IDENTIFIER RDS_ENGINE RDS_ENGINE_VERSION RDS_INSTANCE_CLASS RDS_PORT RDS_DB_NAME SECRET_DRAFT_DIR

cat > "$DATABASE_REPORT_FILE" <<EOF
Dokumen AWS database resources
Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')

AWS_REGION=${AWS_REGION}
PROJECT_NAME=${PROJECT_NAME}
ACCOUNT_ID=${ACCOUNT_ID}
ADMIN_CIDR=${ADMIN_CIDR}

Production RDS instance: ${PROD_RDS_IDENTIFIER}
Production RDS endpoint: ${PROD_RDS_HOST}
Production RDS security group: ${RDS_SG_ID}

Development RDS instance: ${DEV_RDS_IDENTIFIER}
Development RDS endpoint: ${DEV_RDS_HOST}
Development VPC: ${DEV_VPC_ID}
Development RDS security group: ${DEV_RDS_SG_ID}

Secret drafts updated with production DB URLs only:
${SECRET_DRAFT_DIR}

This script creates RDS instances only. Postgres databases, roles, schemas, migrations, and tables are handled separately.
EOF

chmod 600 "$DATABASE_REPORT_FILE" 2>/dev/null || true
echo "Database instances complete."
echo "Resource output: $DATABASE_ENV_FILE"
echo "Report: $DATABASE_REPORT_FILE"
