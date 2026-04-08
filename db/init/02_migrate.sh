#!/bin/bash
set -e

DATABASE_URL="postgres://owner_role:${OWNER_ROLE_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}?sslmode=disable" \
    dbmate --migrations-dir=/migrations up

# better-auth migration — grants require superuser, run as POSTGRES_USER
psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    -f /migrations/better-auth/2025-12-22T03-27-15.344Z.sql

# seed data
for f in /seeds/*.sql; do
    [ -f "$f" ] && psql -v ON_ERROR_STOP=1 \
        --username "$POSTGRES_USER" \
        --dbname "$POSTGRES_DB" \
        -f "$f"
done
