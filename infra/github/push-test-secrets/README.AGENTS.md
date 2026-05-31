# push-test-secrets

- Purpose: push the GitHub Actions secrets and variables needed by `.github/workflows/test-deploy.yml`
- Requires: `AWS_GITHUB_DEPLOY_ROLE_ARN` and `EC2_INSTANCE_ID`
- How to run: copy `infra/github/push-test-secrets/ENV.EXAMPLE` to `infra/github/push-test-secrets/ENV.local`, fill in the values, then run `bash infra/github/push-test-secrets/push-test-secrets.sh`
- Idempotent: updates every secret and variable to the current env file values on each run
