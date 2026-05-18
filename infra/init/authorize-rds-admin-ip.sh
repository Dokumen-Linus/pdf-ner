#!/usr/bin/env bash
# Refresh local /32 Postgres ingress for the prod and dev RDS security groups.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETUP_PARTS_DIR="${SCRIPT_DIR}/aws-setup.d"

# shellcheck source=/dev/null
. "${SETUP_PARTS_DIR}/01_common.sh"

load_local_env
configure_defaults

require_cmd aws
require_cmd curl
require_cmd jq

refresh_rds_admin_ingress
