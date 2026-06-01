#!/usr/bin/env bash

configure_dev_sso_defaults() {
  ENVIRONMENT="${ENVIRONMENT:-development}"
  configure_common_defaults

  DEV_WEB_API_POLICY_NAME="${DEV_WEB_API_POLICY_NAME:-${PROJECT_NAME}-dev-web-api}"
  DEV_SECRETS_POLICY_NAME="${DEV_SECRETS_POLICY_NAME:-${PROJECT_NAME}-dev-read-secrets}"
  DEV_SSO_PERMISSION_SET_NAME="${DEV_SSO_PERMISSION_SET_NAME:-dokudev-pem-set}"
  DEV_SSO_GROUP_NAME="${DEV_SSO_GROUP_NAME:-dokudev-group}"
  DEV_SSO_TARGET_ACCOUNT_ID="${DEV_SSO_TARGET_ACCOUNT_ID:-}"
  IAM_IDENTITY_CENTER_INSTANCE_ARN="${IAM_IDENTITY_CENTER_INSTANCE_ARN:-}"
  IAM_IDENTITY_STORE_ID="${IAM_IDENTITY_STORE_ID:-}"
  FIRST_NAME="${FIRST_NAME:-}"
  LAST_NAME="${LAST_NAME:-}"
  USER_EMAIL="${USER_EMAIL:-}"
  DEV_SSO_USER_NAME="${DEV_SSO_USER_NAME:-}"
}

resolve_target_account_id() {
  if [ -n "$DEV_SSO_TARGET_ACCOUNT_ID" ]; then
    printf '%s' "$DEV_SSO_TARGET_ACCOUNT_ID"
    return
  fi

  aws sts get-caller-identity --query Account --output text
}

resolve_identity_center_instance() {
  local instance_count instance_arn identity_store_id

  if [ -n "$IAM_IDENTITY_CENTER_INSTANCE_ARN" ] && [ -n "$IAM_IDENTITY_STORE_ID" ]; then
    return
  fi

  instance_count="$(aws_region sso-admin list-instances --query 'length(Instances)' --output text)"
  if [ "$instance_count" != "1" ]; then
    echo "Found ${instance_count} IAM Identity Center instances. Set IAM_IDENTITY_CENTER_INSTANCE_ARN and IAM_IDENTITY_STORE_ID in .env.local." >&2
    exit 1
  fi

  instance_arn="$(aws_region sso-admin list-instances --query 'Instances[0].InstanceArn' --output text)"
  identity_store_id="$(aws_region sso-admin list-instances --query 'Instances[0].IdentityStoreId' --output text)"

  if [ -z "$instance_arn" ] || [ "$instance_arn" = "None" ] || [ -z "$identity_store_id" ] || [ "$identity_store_id" = "None" ]; then
    echo "Could not resolve IAM Identity Center instance ARN and identity store ID." >&2
    exit 1
  fi

  IAM_IDENTITY_CENTER_INSTANCE_ARN="$instance_arn"
  IAM_IDENTITY_STORE_ID="$identity_store_id"
}

get_permission_set_arn_by_name() {
  local permission_set_name="$1"
  local permission_set_arns permission_set_arn found_name

  permission_set_arns="$(aws_region sso-admin list-permission-sets \
    --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
    --query 'PermissionSets' \
    --output text)"

  for permission_set_arn in $permission_set_arns; do
    found_name="$(aws_region sso-admin describe-permission-set \
      --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
      --permission-set-arn "$permission_set_arn" \
      --query 'PermissionSet.Name' \
      --output text)"
    if [ "$found_name" = "$permission_set_name" ]; then
      printf '%s' "$permission_set_arn"
      return
    fi
  done
}

ensure_permission_set() {
  local permission_set_name="$1"
  local permission_set_arn

  permission_set_arn="$(get_permission_set_arn_by_name "$permission_set_name")"
  if [ -z "$permission_set_arn" ]; then
    permission_set_arn="$(aws_region sso-admin create-permission-set \
      --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
      --name "$permission_set_name" \
      --description "Development access for ${PROJECT_NAME}" \
      --session-duration PT8H \
      --tags "Key=Name,Value=${permission_set_name}" "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=${ENVIRONMENT}" \
      --query 'PermissionSet.PermissionSetArn' \
      --output text)"
    echo "Created permission set ${permission_set_name}" >&2
  else
    aws_region sso-admin tag-resource \
      --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
      --resource-arn "$permission_set_arn" \
      --tags "Key=Name,Value=${permission_set_name}" "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=${ENVIRONMENT}" >/dev/null
    echo "Permission set already exists: ${permission_set_name}" >&2
  fi

  printf '%s' "$permission_set_arn"
}

create_permission_set() {
  local permission_set_name="$1"
  local permission_set_arn

  permission_set_arn="$(aws_region sso-admin create-permission-set \
    --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
    --name "$permission_set_name" \
    --description "Development access for ${PROJECT_NAME}" \
    --session-duration PT8H \
    --tags "Key=Name,Value=${permission_set_name}" "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=${ENVIRONMENT}" \
    --query 'PermissionSet.PermissionSetArn' \
    --output text)"
  echo "Created permission set ${permission_set_name}" >&2
  printf '%s' "$permission_set_arn"
}

require_local_iam_policy_exists() {
  local policy_name="$1"
  local policy_arn

  policy_arn="$(aws iam list-policies \
    --scope Local \
    --query "Policies[?PolicyName=='${policy_name}'].Arn | [0]" \
    --output text)"

  if [ -z "$policy_arn" ] || [ "$policy_arn" = "None" ]; then
    echo "ERROR: IAM policy ${policy_name} does not exist in target account. Create it before attaching it to ${DEV_SSO_PERMISSION_SET_NAME}." >&2
    exit 1
  fi
}

require_expected_local_iam_policies_exist() {
  require_local_iam_policy_exists "$DEV_SECRETS_POLICY_NAME"
  require_local_iam_policy_exists "$DEV_WEB_API_POLICY_NAME"
}

local_iam_policy_exists() {
  local policy_name="$1"
  local policy_arn

  policy_arn="$(aws iam list-policies \
    --scope Local \
    --query "Policies[?PolicyName=='${policy_name}'].Arn | [0]" \
    --output text)"

  [ -n "$policy_arn" ] && [ "$policy_arn" != "None" ]
}

permission_set_has_exact_customer_managed_policy_refs() {
  local permission_set_arn="$1"
  local expected_one="$2"
  local expected_two="$3"
  local actual_refs expected_refs

  actual_refs="$(aws_region sso-admin list-customer-managed-policy-references-in-permission-set \
    --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
    --permission-set-arn "$permission_set_arn" \
    --query "sort(CustomerManagedPolicyReferences[].join(':', [Name, Path]))" \
    --output text | xargs)"
  expected_refs="$(printf '%s\n%s\n' "${expected_one}:/" "${expected_two}:/" | sort | xargs)"

  [ "$actual_refs" = "$expected_refs" ]
}

permission_set_has_aws_managed_or_inline_policy() {
  local permission_set_arn="$1"
  local aws_managed inline_policy

  aws_managed="$(aws_region sso-admin list-managed-policies-in-permission-set \
    --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
    --permission-set-arn "$permission_set_arn" \
    --query 'AttachedManagedPolicies[].Arn' \
    --output text)"
  if [ -n "$aws_managed" ]; then
    return 0
  fi

  inline_policy="$(aws_region sso-admin get-inline-policy-for-permission-set \
    --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
    --permission-set-arn "$permission_set_arn" \
    --query 'InlinePolicy' \
    --output text 2>/dev/null || true)"
  [ -n "$inline_policy" ] && [ "$inline_policy" != "None" ]
}

permission_set_policy_surface_is_exact() {
  local permission_set_arn="$1"
  local expected_one="$2"
  local expected_two="$3"

  if permission_set_has_aws_managed_or_inline_policy "$permission_set_arn"; then
    return 1
  fi

  permission_set_has_exact_customer_managed_policy_refs "$permission_set_arn" "$expected_one" "$expected_two"
}

wait_for_account_assignment_deletion() {
  local request_id="$1"
  local status failure_reason

  while true; do
    status="$(aws_region sso-admin describe-account-assignment-deletion-status \
      --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
      --account-assignment-deletion-request-id "$request_id" \
      --query 'AccountAssignmentDeletionStatus.Status' \
      --output text)"
    case "$status" in
      SUCCEEDED)
        return
        ;;
      FAILED)
        failure_reason="$(aws_region sso-admin describe-account-assignment-deletion-status \
          --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
          --account-assignment-deletion-request-id "$request_id" \
          --query 'AccountAssignmentDeletionStatus.FailureReason' \
          --output text 2>/dev/null || true)"
        if [ -n "$failure_reason" ] && [ "$failure_reason" != "None" ]; then
          echo "ERROR: account assignment deletion failed: ${failure_reason}" >&2
        else
          echo "ERROR: account assignment deletion failed." >&2
        fi
        exit 1
        ;;
      *)
        sleep 5
        ;;
    esac
  done
}

delete_permission_set_assignments() {
  local permission_set_arn="$1"
  local account_ids account_id assignments principal_type principal_id request_id

  account_ids="$(aws_region sso-admin list-accounts-for-provisioned-permission-set \
    --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
    --permission-set-arn "$permission_set_arn" \
    --query 'AccountIds' \
    --output text)"

  for account_id in $account_ids; do
    assignments="$(aws_region sso-admin list-account-assignments \
      --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
      --account-id "$account_id" \
      --permission-set-arn "$permission_set_arn" \
      --query "AccountAssignments[].join(':', [PrincipalType, PrincipalId])" \
      --output text)"
    for assignment in $assignments; do
      principal_type="${assignment%%:*}"
      principal_id="${assignment#*:}"
      request_id="$(aws_region sso-admin delete-account-assignment \
        --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
        --target-id "$account_id" \
        --target-type AWS_ACCOUNT \
        --permission-set-arn "$permission_set_arn" \
        --principal-type "$principal_type" \
        --principal-id "$principal_id" \
        --query 'AccountAssignmentDeletionStatus.RequestId' \
        --output text)"
      wait_for_account_assignment_deletion "$request_id"
      echo "Deleted ${principal_type} assignment ${principal_id} from account ${account_id}" >&2
    done
  done
}

ensure_clean_permission_set() {
  local permission_set_name="$1"
  local expected_one="$2"
  local expected_two="$3"
  local permission_set_arn

  permission_set_arn="$(get_permission_set_arn_by_name "$permission_set_name")"
  if [ -z "$permission_set_arn" ]; then
    create_permission_set "$permission_set_name"
    return
  fi

  if permission_set_policy_surface_is_exact "$permission_set_arn" "$expected_one" "$expected_two"; then
    aws_region sso-admin tag-resource \
      --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
      --resource-arn "$permission_set_arn" \
      --tags "Key=Name,Value=${permission_set_name}" "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=${ENVIRONMENT}" >/dev/null
    echo "Permission set already has exactly the configured customer managed policies: ${permission_set_name}" >&2
    printf '%s' "$permission_set_arn"
    return
  fi

  echo "Recreating permission set ${permission_set_name} because its policies do not exactly match ${expected_one} and ${expected_two}" >&2
  delete_permission_set_assignments "$permission_set_arn"
  aws_region sso-admin delete-permission-set \
    --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
    --permission-set-arn "$permission_set_arn" >/dev/null
  create_permission_set "$permission_set_name"
}

require_permission_set_has_no_inline_or_aws_managed_access() {
  local permission_set_arn="$1"
  local aws_managed inline_policy

  aws_managed="$(aws_region sso-admin list-managed-policies-in-permission-set \
    --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
    --permission-set-arn "$permission_set_arn" \
    --query 'AttachedManagedPolicies[].Arn' \
    --output text)"
  if [ -n "$aws_managed" ]; then
    echo "ERROR: ${DEV_SSO_PERMISSION_SET_NAME} has AWS managed policies attached. Remove them manually before running this script." >&2
    exit 1
  fi

  inline_policy="$(aws_region sso-admin get-inline-policy-for-permission-set \
    --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
    --permission-set-arn "$permission_set_arn" \
    --query 'InlinePolicy' \
    --output text 2>/dev/null || true)"
  if [ -n "$inline_policy" ] && [ "$inline_policy" != "None" ]; then
    echo "ERROR: ${DEV_SSO_PERMISSION_SET_NAME} has an inline policy. Remove it manually before running this script." >&2
    exit 1
  fi
}

detach_missing_customer_managed_policy_references() {
  local permission_set_arn="$1"
  local refs ref policy_name policy_path

  refs="$(aws_region sso-admin list-customer-managed-policy-references-in-permission-set \
    --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
    --permission-set-arn "$permission_set_arn" \
    --query "CustomerManagedPolicyReferences[].join(':', [Name, Path])" \
    --output text)"
  for ref in $refs; do
    policy_name="${ref%%:*}"
    policy_path="${ref#*:}"
    if ! local_iam_policy_exists "$policy_name"; then
      aws_region sso-admin detach-customer-managed-policy-reference-from-permission-set \
        --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
        --permission-set-arn "$permission_set_arn" \
        --customer-managed-policy-reference "Name=${policy_name},Path=${policy_path}" >/dev/null
      echo "Detached missing customer managed policy reference ${policy_name} at path ${policy_path}"
    fi
  done
}

warn_unexpected_customer_managed_policy_references() {
  local permission_set_arn="$1"
  local allowed_one="$2"
  local allowed_two="$3"
  local refs ref policy_name policy_path

  refs="$(aws_region sso-admin list-customer-managed-policy-references-in-permission-set \
    --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
    --permission-set-arn "$permission_set_arn" \
    --query "CustomerManagedPolicyReferences[].join(':', [Name, Path])" \
    --output text)"
  for ref in $refs; do
    policy_name="${ref%%:*}"
    policy_path="${ref#*:}"
    if [ "$policy_path" != "/" ] || { [ "$policy_name" != "$allowed_one" ] && [ "$policy_name" != "$allowed_two" ]; }; then
      echo "WARNING: ${DEV_SSO_PERMISSION_SET_NAME} also references customer managed policy ${policy_name} at path ${policy_path}; leaving it attached." >&2
    fi
  done
}

customer_managed_policy_attached() {
  local permission_set_arn="$1"
  local policy_name="$2"
  local attached_name

  attached_name="$(aws_region sso-admin list-customer-managed-policy-references-in-permission-set \
    --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
    --permission-set-arn "$permission_set_arn" \
    --query "CustomerManagedPolicyReferences[?Name=='${policy_name}' && Path=='/'].Name | [0]" \
    --output text)"

  [ -n "$attached_name" ] && [ "$attached_name" != "None" ]
}

ensure_customer_managed_policy_attached() {
  local permission_set_arn="$1"
  local policy_name="$2"

  if customer_managed_policy_attached "$permission_set_arn" "$policy_name"; then
    echo "Permission set already references customer managed policy ${policy_name}"
    return
  fi

  aws_region sso-admin attach-customer-managed-policy-reference-to-permission-set \
    --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
    --permission-set-arn "$permission_set_arn" \
    --customer-managed-policy-reference "Name=${policy_name},Path=/" >/dev/null
  echo "Attached customer managed policy reference ${policy_name}"
}

get_group_id_by_display_name() {
  local group_name="$1"

  aws_region identitystore list-groups \
    --identity-store-id "$IAM_IDENTITY_STORE_ID" \
    --filters "AttributePath=DisplayName,AttributeValue=${group_name}" \
    --query 'Groups[0].GroupId' \
    --output text | awk 'NF && $1 != "None" { print $1; exit }'
}

ensure_group() {
  local group_name="$1"
  local group_id

  group_id="$(get_group_id_by_display_name "$group_name")"
  if [ -z "$group_id" ]; then
    group_id="$(aws_region identitystore create-group \
      --identity-store-id "$IAM_IDENTITY_STORE_ID" \
      --display-name "$group_name" \
      --description "Development access for ${PROJECT_NAME}" \
      --query 'GroupId' \
      --output text)"
    echo "Created Identity Center group ${group_name}" >&2
  else
    echo "Identity Center group already exists: ${group_name}" >&2
  fi

  printf '%s' "$group_id"
}

get_user_id_by_user_name() {
  local user_name="$1"

  aws_region identitystore list-users \
    --identity-store-id "$IAM_IDENTITY_STORE_ID" \
    --filters "AttributePath=UserName,AttributeValue=${user_name}" \
    --query 'Users[0].UserId' \
    --output text | awk 'NF && $1 != "None" { print $1; exit }'
}

ensure_user() {
  local user_name="$1"
  local first_name="$2"
  local last_name="$3"
  local user_email="$4"
  local display_name user_id

  user_id="$(get_user_id_by_user_name "$user_name")"
  if [ -z "$user_id" ]; then
    display_name="${first_name} ${last_name}"
    user_id="$(aws_region identitystore create-user \
      --identity-store-id "$IAM_IDENTITY_STORE_ID" \
      --user-name "$user_name" \
      --name "FamilyName=${last_name},GivenName=${first_name}" \
      --display-name "$display_name" \
      --emails "Value=${user_email},Type=work,Primary=true" \
      --query 'UserId' \
      --output text)"
    echo "Created Identity Center user ${user_name}" >&2
  else
    echo "Identity Center user already exists: ${user_name}" >&2
  fi

  printf '%s' "$user_id"
}

group_membership_id() {
  local group_id="$1"
  local user_id="$2"

  aws_region identitystore list-group-memberships \
    --identity-store-id "$IAM_IDENTITY_STORE_ID" \
    --group-id "$group_id" \
    --query "GroupMemberships[?MemberId.UserId=='${user_id}'].MembershipId | [0]" \
    --output text | awk 'NF && $1 != "None" { print $1; exit }'
}

ensure_group_membership() {
  local group_id="$1"
  local user_id="$2"
  local membership_id

  membership_id="$(group_membership_id "$group_id" "$user_id")"
  if [ -n "$membership_id" ]; then
    echo "User is already a member of ${DEV_SSO_GROUP_NAME}"
    return
  fi

  aws_region identitystore create-group-membership \
    --identity-store-id "$IAM_IDENTITY_STORE_ID" \
    --group-id "$group_id" \
    --member-id "UserId=${user_id}" >/dev/null
  echo "Added user to ${DEV_SSO_GROUP_NAME}"
}

account_assignment_exists() {
  local permission_set_arn="$1"
  local principal_id="$2"
  local account_id="$3"
  local assignment_principal

  assignment_principal="$(aws_region sso-admin list-account-assignments \
    --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
    --account-id "$account_id" \
    --permission-set-arn "$permission_set_arn" \
    --query "AccountAssignments[?PrincipalType=='GROUP' && PrincipalId=='${principal_id}'].PrincipalId | [0]" \
    --output text)"

  [ -n "$assignment_principal" ] && [ "$assignment_principal" != "None" ]
}

wait_for_account_assignment() {
  local request_id="$1"
  local status

  while true; do
    status="$(aws_region sso-admin describe-account-assignment-creation-status \
      --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
      --account-assignment-creation-request-id "$request_id" \
      --query 'AccountAssignmentCreationStatus.Status' \
      --output text)"
    case "$status" in
      SUCCEEDED)
        return
        ;;
      FAILED)
        echo "ERROR: account assignment creation failed." >&2
        exit 1
        ;;
      *)
        sleep 5
        ;;
    esac
  done
}

ensure_account_assignment() {
  local permission_set_arn="$1"
  local group_id="$2"
  local account_id="$3"
  local request_id

  if account_assignment_exists "$permission_set_arn" "$group_id" "$account_id"; then
    echo "Group ${DEV_SSO_GROUP_NAME} is already assigned to account ${account_id}"
    return
  fi

  request_id="$(aws_region sso-admin create-account-assignment \
    --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
    --target-id "$account_id" \
    --target-type AWS_ACCOUNT \
    --permission-set-arn "$permission_set_arn" \
    --principal-type GROUP \
    --principal-id "$group_id" \
    --query 'AccountAssignmentCreationStatus.RequestId' \
    --output text)"
  wait_for_account_assignment "$request_id"
  echo "Assigned ${DEV_SSO_GROUP_NAME} to account ${account_id}"
}

wait_for_permission_set_provisioning() {
  local request_id="$1"
  local status failure_reason

  while true; do
    status="$(aws_region sso-admin describe-permission-set-provisioning-status \
      --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
      --provision-permission-set-request-id "$request_id" \
      --query 'PermissionSetProvisioningStatus.Status' \
      --output text)"
    case "$status" in
      SUCCEEDED)
        return
        ;;
      FAILED)
        failure_reason="$(aws_region sso-admin describe-permission-set-provisioning-status \
          --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
          --provision-permission-set-request-id "$request_id" \
          --query 'PermissionSetProvisioningStatus.FailureReason' \
          --output text 2>/dev/null || true)"
        if [ -n "$failure_reason" ] && [ "$failure_reason" != "None" ]; then
          echo "ERROR: permission set provisioning failed: ${failure_reason}" >&2
        else
          echo "ERROR: permission set provisioning failed." >&2
        fi
        exit 1
        ;;
      *)
        sleep 5
        ;;
    esac
  done
}

provision_permission_set() {
  local permission_set_arn="$1"
  local account_id="$2"
  local request_id

  request_id="$(aws_region sso-admin provision-permission-set \
    --instance-arn "$IAM_IDENTITY_CENTER_INSTANCE_ARN" \
    --permission-set-arn "$permission_set_arn" \
    --target-type AWS_ACCOUNT \
    --target-id "$account_id" \
    --query 'PermissionSetProvisioningStatus.RequestId' \
    --output text)"
  wait_for_permission_set_provisioning "$request_id"
  echo "Provisioned ${DEV_SSO_PERMISSION_SET_NAME} to account ${account_id}"
}
