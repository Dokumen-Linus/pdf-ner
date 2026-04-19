#!/bin/bash
set -e

# Roles and schemas come from 01_roles.sh, which is generated from _init.sql.
# Run Better Auth first so numbered migrations can safely reference auth tables.
psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    -f /migrations/better-auth/setup.sql

DATABASE_URL="postgres://owner_role:${OWNER_ROLE_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}?sslmode=disable" \
    dbmate --migrations-dir=/migrations up

# seed data
for f in /seeds/*.sql; do
    [ -f "$f" ] && psql -v ON_ERROR_STOP=1 \
        --username "$POSTGRES_USER" \
        --dbname "$POSTGRES_DB" \
        -f "$f"
done
