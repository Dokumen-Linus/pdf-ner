# push-secrets

- Purpose: push required GitHub Actions secrets and variables to the repository via the GitHub CLI
- Requires: `AWS_GITHUB_DEPLOY_ROLE_ARN`, `EC2_INSTANCE_ID`, and `VITE_BASE_URL`
- How to run: copy `infra/github/push-secrets/.env.example` to `infra/github/push-secrets/.env.local`, fill in the values, then run `bash infra/github/push-secrets/push-secrets.sh`
- Idempotent: updates every secret and variable to the current env file values on each run; `VITE_STRIPE_PUBLISHABLE_KEY` is silently skipped when unset
