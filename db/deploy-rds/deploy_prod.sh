#!/usr/bin/env bash
set -euo pipefail

# Resolve paths relative to this script so it can run from any directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load local RDS deploy environment values for production database bootstrap.
ENV_FILE="${RDS_DEPLOY_ENV_FILE:-${SCRIPT_DIR}/.env.production}"
echo "Loading ${ENV_FILE}..."
set -a
source "$ENV_FILE"
set +a

# Require the production tunnel and RDS endpoint settings.
: "${PROD_RDS_ENDPOINT:?PROD_RDS_ENDPOINT is required}"
: "${PROD_SSH_KEY:?PROD_SSH_KEY is required}"
: "${PROD_EC2_HOST:?PROD_EC2_HOST is required}"
: "${PROD_LOCAL_RDS_PORT:?PROD_LOCAL_RDS_PORT is required}"

# Check that the local SSH tunnel to private prod RDS is open.
echo "Checking local SSH tunnel for prod RDS on 127.0.0.1:${PROD_LOCAL_RDS_PORT}..."
if ! nc -zv 127.0.0.1 "$PROD_LOCAL_RDS_PORT"; then
  echo ""
  echo "ERROR: No process is listening on 127.0.0.1:${PROD_LOCAL_RDS_PORT}."
  echo "Open the SSH tunnel in a separate terminal and leave it running:"
  echo "ssh -o IdentitiesOnly=yes -o IdentityAgent=none -i ${PROD_SSH_KEY} -N -L ${PROD_LOCAL_RDS_PORT}:${PROD_RDS_ENDPOINT}:5432 ec2-user@${PROD_EC2_HOST}"
  exit 1
fi

# Point the RDS deploy scripts at the local SSH tunnel instead of the private RDS hostname.
export RDS_HOST=127.0.0.1
export RDS_PORT="$PROD_LOCAL_RDS_PORT"

# Use encrypted PostgreSQL connections through the tunnel.
export PGSSLMODE=require

# Show the non-secret connection target that will be used by the deploy scripts.
echo "Running RDS deploy through ${RDS_HOST}:${RDS_PORT} with PGSSLMODE=${PGSSLMODE}..."

# Run the full RDS database, role, schema, migration, seed, and healthcheck bootstrap.
bash "${SCRIPT_DIR}/run_all.sh"
