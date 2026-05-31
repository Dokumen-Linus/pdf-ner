# Dokumen Infrastructure

- `aws\`: scripts for initial AWS resource setup, pushing secrets, and other AWS interaction
- `cloudflare\`: scripts for Cloudflare WAF and Tunnel setup
- `github\`: scripts for GitHub setup
- `runpod\`: scripts for creating and managing runpod instances as well as their AWS ECR images and granting the EC2 access
- `docker-compose.yml`: main file to run the apps locally
- `.env.prod.example`: example of `.env.prod` to define the public web client-side environment variables and environment variables for the CI flow

`.env.prod` is reserved for this file. All other files in this repo should be `.env.production`, `.env.development` or `.env.local`.

## RDS Databases

1. Resources created in `infra/aws/setup-database`
2. Database initialization in `db/deploy-rds`

Dev database instance: `dokudev`
Prod database instance: `dokuprod`

## GitHub Actions CI

The deploy workflows in `.github/workflows/` build Docker images, push them to ECR, then use AWS Systems Manager Run Command to tell the EC2 instance to pull and start/restart Compose services.

Use `Deploy Stack` (`.github/workflows/deploy-stack.yml`) as the first app start
path after EC2 bootstrap. It builds the `web`, `api`, and `workers` images,
pushes them to ECR, starts `redis api worker web` on EC2 through SSM, and runs
the EC2 health check. It is manual-only; use the `Deploy Web`, `Deploy API`,
and `Deploy Workers` workflows for targeted redeploys after the stack has
already been started.

- Trigger `Deploy Stack` manually with the GitHub CLI when bootstrapping or
  intentionally redeploying the full app stack:

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

The deploy workflows currently create a temporary Compose override on EC2 that sets the selected service image to the new ECR image tag. This keeps `infra/docker-compose.yml` usable for manual local builds while CI/CD can deploy prebuilt images.
