# Workflows

- auto-docs: generate CHANGELOG.md and .codesight/wiki
- auto-format: format code (Python with ruff, TypeScript with prettier and eslint)
- commitlint: enforces commit pattern
- deploy-api: deploy API to AWS
- deploy-web: deploy web to AWS
- deploy-workers: deploy workers to AWS
- deploy-stack: [1] build all app images [2] deploy all images to the EC2 [3] start the Compose services
- ec2-healthcheck: manual-only wait-then-run EC2 health check; deploy workflows must not call it automatically
- restart: restart the Compose services with the existing images
- test-deploy: test steps [2] and [3] of deploy-stack

## Manual Deploy Stack

`deploy-stack.yml` must be trigger manually after bootstrap or when intentionally redeploying new images for all apps 

```bash
gh workflow run "Deploy Stack" --ref master
```

Required GitHub Actions secrets:

| Name | Used by | Value |
| --- | --- | --- |
| `AWS_GITHUB_DEPLOY_ROLE_ARN` | all deploy workflows | ARN of the AWS IAM role that GitHub Actions assumes through OIDC. |
| `EC2_INSTANCE_ID` | all deploy workflows | The EC2 instance ID, for example `i-0123456789abcdef0`. |

Required GitHub Actions variables:

| Name | Used by | Example |
| --- | --- | --- |
| `VITE_BASE_URL` | web build | `https://dokumenai.dev` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | web build | `<your Stripe publishable key>` |

Recommended or optional GitHub Actions variables:

| Name | Default | Used by |
| --- | --- | --- |
| `AWS_REGION` | `us-east-1` | all deploy workflows |
| `WEB_ECR_REPOSITORY` | `dokumen-web` | web and stack deploys |
| `API_ECR_REPOSITORY` | `dokumen-api` | API and stack deploys |
| `WORKERS_ECR_REPOSITORY` | `dokumen-workers` | workers and stack deploys |
| `EC2_APP_DIR` | `/opt/dokumen/pdf-ner` | all deploy workflows |
| `EC2_DEPLOY_STATE_DIR` | `/opt/dokumen/deploy-state` | all deploy workflows |
