#!/usr/bin/env bash

setup_prod_rds() {
  if [ "$CREATE_PROD_RDS" != "1" ]; then
    echo ""
  echo ">>> Production RDS"
    echo "    CREATE_PROD_RDS=0, skipped production RDS setup."
    return
  fi

  echo ""
  echo ">>> 8. Production RDS"
  require_setup_values "Production RDS" VPC_ID SG_ID PRIVATE_SUBNET_ID PRIVATE_SUBNET_2_ID
  validate_rds_master_password PROD_RDS_MASTER_PASSWORD
  if [ "$PROD_RDS_ALLOW_LOCAL_ADMIN" = "1" ]; then
    refresh_current_admin_ip
  fi

  RDS_SG_ID="$(ensure_security_group "$PROD_RDS_SG_NAME" "Dokumen production Postgres" "$VPC_ID")"
  authorize_tcp_from_sg "$RDS_SG_ID" "$RDS_PORT" "$SG_ID"
  if [ "$PROD_RDS_ALLOW_LOCAL_ADMIN" = "1" ]; then
    authorize_tcp_from_cidr "$RDS_SG_ID" "$RDS_PORT" "$MY_IP"
  fi
  echo "    RDS security group: $RDS_SG_ID"
  echo "    EC2 Postgres access: $SG_ID"
  if [ "$PROD_RDS_ALLOW_LOCAL_ADMIN" = "1" ]; then
    echo "    Local admin CIDR: $MY_IP"
  else
    echo "    Local admin CIDR: disabled"
  fi

  ensure_db_subnet_group \
    "$PROD_RDS_SUBNET_GROUP_NAME" \
    "Dokumen production RDS private subnets" \
    "$PRIVATE_SUBNET_ID" "$PRIVATE_SUBNET_2_ID"
  echo "    DB subnet group: $PROD_RDS_SUBNET_GROUP_NAME"

  ensure_postgres_rds_instance \
    "$PROD_RDS_IDENTIFIER" \
    "$PROD_RDS_SUBNET_GROUP_NAME" \
    "$RDS_SG_ID" \
    "$PROD_RDS_MASTER_PASSWORD" \
    false \
    "$(bool_flag "$RDS_DELETION_PROTECTION")" \
    "$(bool_flag "$PROD_RDS_MULTI_AZ")"

  PROD_RDS_HOST="$(get_rds_endpoint "$PROD_RDS_IDENTIFIER")"
  echo "    RDS endpoint: $PROD_RDS_HOST"

  if [ -n "${AUTH_ROLE_PASSWORD:-}" ] &&
    [ -n "${WEB_USER_PASSWORD:-}" ] &&
    [ -n "${API_USER_PASSWORD:-}" ] &&
    [ -n "${WORKERS_USER_PASSWORD:-}" ]; then
    ensure_secret_drafts
    set_secret_draft_value prod-web.json DATABASE_URL "$(postgres_url web_user "$WEB_USER_PASSWORD" "$PROD_RDS_HOST" "$RDS_DB_NAME")"
    set_secret_draft_value prod-web.json WEB_DATABASE_URL "$(postgres_url web_user "$WEB_USER_PASSWORD" "$PROD_RDS_HOST" "$RDS_DB_NAME")"
    set_secret_draft_value prod-web.json AUTH_DATABASE_URL "$(postgres_url auth_role "$AUTH_ROLE_PASSWORD" "$PROD_RDS_HOST" "$RDS_DB_NAME")"
    set_secret_draft_value prod-api.json API_DATABASE_URL "$(postgres_url api_user "$API_USER_PASSWORD" "$PROD_RDS_HOST" "$RDS_DB_NAME")"
    set_secret_draft_value prod-workers.json WORKERS_DATABASE_URL "$(postgres_url workers_user "$WORKERS_USER_PASSWORD" "$PROD_RDS_HOST" "$RDS_DB_NAME")"
    echo "    Updated local secret drafts with production DB URLs."
  else
    echo "    Skipped DB URL draft updates; set AUTH_ROLE_PASSWORD, WEB_USER_PASSWORD,"
    echo "    API_USER_PASSWORD, and WORKERS_USER_PASSWORD to patch local secret drafts."
  fi
}
