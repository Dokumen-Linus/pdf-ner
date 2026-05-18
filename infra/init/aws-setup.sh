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
#   SETUP_RESUME=1 bash infra/init/aws-setup.sh
#   SETUP_STOP_AFTER=networking bash infra/init/aws-setup.sh
#   SETUP_START_AT=prod-rds bash infra/init/aws-setup.sh
#
# Generated secret drafts are written to infra/init/local-secrets/ by default.
# Review and complete them, then run infra/init/create-secrets.sh.
# =============================================================================

set -Eeuo pipefail

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
  08_prod_rds.sh \
  09_dev_rds.sh \
  10_ses_identity.sh \
  11_ec2_compose_deploy.sh \
  12_summary.sh; do
  # shellcheck source=/dev/null
  . "${SETUP_PARTS_DIR}/${part}"
done

SETUP_STEP_IDS=(
  prerequisites
  networking
  ec2-instance
  avatar-bucket
  ecr-runtime-iam
  github-deploy-iam
  prod-rds
  dev-rds
  rds-admin-ingress
  secrets-ses
  ec2-deployment
  summary
)

SETUP_STEP_LABELS=(
  "Prerequisites"
  "VPC and networking"
  "EC2 instance"
  "Avatar bucket"
  "ECR and EC2 runtime IAM"
  "GitHub deployment IAM"
  "Production RDS"
  "Development RDS"
  "RDS admin ingress refresh"
  "Secret drafts and SES identity"
  "EC2 deployment"
  "Summary"
)

SETUP_STEP_FUNCTIONS=(
  check_prerequisites
  setup_networking
  setup_ec2_instance
  setup_avatar_bucket
  setup_ecr_and_runtime_role
  setup_github_deploy_role
  setup_prod_rds
  setup_dev_rds
  refresh_rds_admin_ingress
  setup_ses_identity
  deploy_to_ec2
  print_summary
)

setup_step_index() {
  local step_id="$1"
  local index

  for index in "${!SETUP_STEP_IDS[@]}"; do
    if [ "${SETUP_STEP_IDS[$index]}" = "$step_id" ]; then
      printf '%s' "$index"
      return 0
    fi
  done

  echo "ERROR: unknown setup step id: $step_id" >&2
  echo "Valid step ids: ${SETUP_STEP_IDS[*]}" >&2
  return 1
}

first_incomplete_step_index() {
  local index

  for index in "${!SETUP_STEP_IDS[@]}"; do
    if ! setup_step_completed "${SETUP_STEP_IDS[$index]}"; then
      printf '%s' "$index"
      return 0
    fi
  done

  return 1
}

run_selected_setup_steps() {
  local start_index stop_index last_index index
  # shellcheck disable=SC2034
  CURRENT_SETUP_STEP="selection"
  last_index=$((${#SETUP_STEP_IDS[@]} - 1))
  start_index=0
  stop_index="$last_index"

  if [ -n "$SETUP_ONLY" ]; then
    start_index="$(setup_step_index "$SETUP_ONLY")"
    stop_index="$start_index"
  else
    if [ -n "$SETUP_START_AT" ]; then
      start_index="$(setup_step_index "$SETUP_START_AT")"
    elif [ "$SETUP_RESUME" = "1" ]; then
      if start_index="$(first_incomplete_step_index)"; then
        echo "Resuming at first incomplete step: ${SETUP_STEP_IDS[$start_index]}"
      else
        echo "All setup steps are already marked complete in $SETUP_STATE_FILE."
        echo "Use SETUP_START_AT=<step-id> or SETUP_ONLY=<step-id> to rerun a step intentionally."
        return
      fi
    fi

    if [ -n "$SETUP_STOP_AFTER" ]; then
      stop_index="$(setup_step_index "$SETUP_STOP_AFTER")"
    fi
  fi

  if [ "$stop_index" -lt "$start_index" ]; then
    echo "ERROR: SETUP_STOP_AFTER comes before the selected start step." >&2
    echo "Start: ${SETUP_STEP_IDS[$start_index]}, stop: ${SETUP_STEP_IDS[$stop_index]}" >&2
    return 1
  fi

  echo "Selected setup steps: ${SETUP_STEP_IDS[$start_index]} -> ${SETUP_STEP_IDS[$stop_index]}"
  for ((index = start_index; index <= stop_index; index++)); do
    run_setup_step \
      "${SETUP_STEP_IDS[$index]}" \
      "${SETUP_STEP_LABELS[$index]}" \
      "${SETUP_STEP_FUNCTIONS[$index]}"
  done
}

main() {
  load_local_env
  configure_defaults
  load_setup_state
  trap handle_setup_error ERR
  print_banner
  run_selected_setup_steps
}

main "$@"
