#!/usr/bin/env bash
# =============================================================================
# Dokumen AI - AWS infrastructure and EC2 Compose deployment
# =============================================================================
#
# Usage:
#   chmod +x infra/init/aws-setup.sh
#   bash infra/init/aws-setup.sh
#
# Common overrides:
#   cp infra/init/.env.example infra/init/.env.local
#   cp infra/.env.prod.example infra/.env.prod
#   bash infra/init/aws-setup.sh
#   DO_DEPLOY=0 bash infra/init/aws-setup.sh
#
# Generated secret drafts are written to infra/init/local-secrets/ by default.
# Review and complete them, then run infra/init/create-secrets.sh.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETUP_PARTS_DIR="${SCRIPT_DIR}/aws-setup.d"

for part in \
  01_common.sh \
  02_prerequisites.sh \
  03_networking.sh \
  04_ec2_instance.sh \
  05_avatars_bucket.sh \
  06_ecr_and_runtime_role.sh \
  07_github_deploy_role.sh \
  09_ses_identity.sh \
  10_ec2_compose_deploy.sh \
  11_summary.sh; do
  # shellcheck source=/dev/null
  . "${SETUP_PARTS_DIR}/${part}"
done

main() {
  load_local_env
  configure_defaults
  print_banner
  check_prerequisites
  setup_networking
  setup_ec2_instance
  setup_avatar_bucket
  setup_ecr_and_runtime_role
  setup_github_deploy_role
  setup_ses_identity
  deploy_to_ec2
  print_summary
}

main "$@"
