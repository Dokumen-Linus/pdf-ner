# setup-gh-actions-role

- Purpose: create or update the GitHub Actions OIDC deploy role and managed policy used by deploy workflows
- Executed by: `infra/aws/setup-gh-actions-role/setup-gh-actions-role.sh`
- Depends on: an existing EC2 instance ID from `infra/aws/setup-ec2/setup-ec2.sh`
- Idempotent for the IAM role, trust policy, OIDC provider, policy versions, and role attachment
