#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "${SCRIPT_DIR}/01_create_database_roles_schemas.sh"
bash "${SCRIPT_DIR}/02_migrate_and_seed.sh"
bash "${SCRIPT_DIR}/03_healthcheck.sh"
