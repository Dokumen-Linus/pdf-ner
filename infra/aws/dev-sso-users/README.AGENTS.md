# dev-sso-users

- Purpose: manage development IAM Identity Center access for the current AWS account.
- `create-web-api-policy.sh` creates or updates the local IAM customer managed policy used by the development web/API permission set.
- `create-permission-set-group.sh` creates or ensures the development permission set, recreating it first if its existing policies are not exactly the configured customer managed policies, then creates or ensures the development group, assigns the group to the target account, and provisions the permission set.
- `create-sso-user.sh` creates or ensures a development Identity Center user and adds it to the development group.
- The scripts are idempotent. `create-permission-set-group.sh` deletes existing assignments and recreates the permission set when policy references drift from `DEV_SECRETS_POLICY_NAME` and `DEV_WEB_API_POLICY_NAME`.
- AWS CLI-created Identity Center users do not receive a password or the console's "Send email verification link" email from these scripts. AWS documents this as console/settings behavior: either a human sends the verification/reset email in the IAM Identity Center console, or IAM Identity Center's `Send email OTP` setting is enabled so API/CLI-created users receive a verification email after their first sign-in attempt.
