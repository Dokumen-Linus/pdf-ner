#!/bin/bash
set -e

# Roles and schemas come from 01_roles.sh, which is generated from _init.sql.
# Run Better Auth first so numbered migrations can safely reference auth tables.
echo "Running Better Auth setup against ${POSTGRES_DB}..."
echo "NOTE: This is a one-time setup block. If it fails because auth tables or indexes already exist,"
echo "      comment out the block between BEGIN ONE-TIME BETTER AUTH SETUP and END ONE-TIME BETTER AUTH SETUP,"
echo "      then rerun this script."
# BEGIN ONE-TIME BETTER AUTH SETUP
psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    -f /migrations/better-auth/setup.sql
# END ONE-TIME BETTER AUTH SETUP

echo "Running dbmate migrations as owner_role..."
DATABASE_URL="postgres://owner_role:${OWNER_ROLE_PASSWORD}@/${POSTGRES_DB}?host=/var/run/postgresql&sslmode=disable" \
    dbmate --migrations-dir=/migrations up

echo "Running seed SQL files..."
for f in /seeds/*.sql; do
    [ -f "$f" ] || continue
    echo "Executing ${f}"
    psql -v ON_ERROR_STOP=1 \
        --username "$POSTGRES_USER" \
        --dbname "$POSTGRES_DB" \
        -f "$f"
done

echo "Running standard entity type seed SQL files..."
for f in /seeds/standard_entity_types/*.sql; do
    [ -f "$f" ] || continue
    echo "Executing ${f}"
    psql -v ON_ERROR_STOP=1 \
        --username "$POSTGRES_USER" \
        --dbname "$POSTGRES_DB" \
        -f "$f"
done
