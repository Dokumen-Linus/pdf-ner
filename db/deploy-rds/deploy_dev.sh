#!/usr/bin/env bash
set -euo pipefail

# Resolve paths relative to this script so it can run from any directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load the local RDS deploy environment values after you update them for dev.
ENV_FILE="${RDS_DEPLOY_ENV_FILE:-${SCRIPT_DIR}/.env.development}"
set -a
source "$ENV_FILE"
set +a

# Require the public development RDS endpoint settings.
: "${DEV_RDS_ENDPOINT:?DEV_RDS_ENDPOINT is required}"
: "${DEV_RDS_PORT:?DEV_RDS_PORT is required}"

# Check that the development RDS endpoint is reachable from this workstation.
nc -zv "$DEV_RDS_ENDPOINT" "$DEV_RDS_PORT"

# Point the RDS deploy scripts at the development RDS endpoint directly.
export RDS_HOST="$DEV_RDS_ENDPOINT"
export RDS_PORT="$DEV_RDS_PORT"

# Use encrypted PostgreSQL connections.
export PGSSLMODE=require

# Show the non-secret connection target that will be used by the deploy scripts.
echo "Running RDS deploy against dev database at ${RDS_HOST}:${RDS_PORT} with PGSSLMODE=${PGSSLMODE}..."

# Run the full RDS database, role, schema, migration, seed, and healthcheck bootstrap.
bash "${SCRIPT_DIR}/run_all.sh"
