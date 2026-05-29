# Initial AWS Deployment

- `aws\`: scripts for initial AWS resource setup, pushing secrets, or other AWS interaction
- `runpod\`: scripts for creating and managing runpod instances as well as their AWS ECR images and granting the EC2 access
- `.env.prod.example`: example of `.env.prod` to define the public web client-side environment variables and environment variables for the CI flow

## RDS Databases

1. Resources created in `infra/aws/setup-database`
2. Database initialization in `db/deploy-rds`

Dev database instance: `dokudev`
Prod database instance: `dokuprod`

## GitHub Actions CI

The deploy workflows in `.github/workflows/` build Docker images, push them to
ECR, then use AWS Systems Manager Run Command to tell the EC2 instance to pull
and start or restart Compose services.

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

Create the GitHub values in the repository UI:

1. Open the GitHub repository.
2. Go to Settings -> Secrets and variables -> Actions.
3. Add `AWS_GITHUB_DEPLOY_ROLE_ARN` and `EC2_INSTANCE_ID` under Secrets.
4. Add `VITE_BASE_URL` and `VITE_STRIPE_PUBLISHABLE_KEY` under Variables.
5. Add the optional repository-name/path variables only if you want values
   different from the workflow defaults.

Or create them with the GitHub CLI from your local machine:

```bash
gh secret set AWS_GITHUB_DEPLOY_ROLE_ARN --body "arn:aws:iam::123456789012:role/dokumen-github-deploy"
gh secret set EC2_INSTANCE_ID --body "i-0123456789abcdef0"

gh variable set AWS_REGION --body "us-east-1"
gh variable set VITE_BASE_URL --body "https://dokumenai.dev"
gh variable set VITE_STRIPE_PUBLISHABLE_KEY --body "<your Stripe publishable key>"
gh variable set API_ECR_REPOSITORY --body "dokumen-api"
gh variable set WEB_ECR_REPOSITORY --body "dokumen-web"
gh variable set WORKERS_ECR_REPOSITORY --body "dokumen-workers"
gh variable set EC2_APP_DIR --body "/opt/dokumen/pdf-ner"
gh variable set EC2_DEPLOY_STATE_DIR --body "/opt/dokumen/deploy-state"
```

AWS setup required for GitHub Actions:

`infra/init/aws-setup.sh` handles the AWS setup for the default path:

1. Creates ECR repositories named `dokumen-web`, `dokumen-api`,
   `dokumen-workers`, `dokumen-deepseek-ocr`, and `dokumen-olm-ocr2`,
   unless you override the names.
2. Creates or updates the EC2 runtime role and instance profile.
3. Attaches `AmazonSSMManagedInstanceCore` to the EC2 role.
4. Grants the EC2 role ECR pull permissions and `secretsmanager:GetSecretValue`
   on `prod/web`, `prod/email`, `prod/api`, `prod/workers`, and `prod/runpod`.
5. Creates the GitHub OIDC provider if needed.
6. Creates or updates the GitHub deploy role restricted to
   `GITHUB_REPO` and `DEPLOY_BRANCH`.
7. Grants the GitHub deploy role ECR push permissions and SSM command
   permissions for the EC2 instance.
8. Creates or updates production and development RDS by default.
9. Refreshes current-IP admin ingress on the managed prod/dev RDS security
   groups.
10. Writes reviewed local Secrets Manager draft files to
   `infra/init/local-secrets/`; it does not create AWS Secrets Manager secrets.
11. Run `db/deploy-rds/run_all.sh` against each RDS endpoint you want
   initialized.

Configure these in `infra/init/.env.local` before running the script:

```env
GITHUB_REPO=your-org/pdf-ner
DEPLOY_BRANCH=master
WEB_ECR_REPOSITORY=dokumen-web
API_ECR_REPOSITORY=dokumen-api
WORKERS_ECR_REPOSITORY=dokumen-workers
PROD_RDS_IDENTIFIER=dokuprod
DEV_RDS_IDENTIFIER=dokudev
CREATE_PROD_RDS=1
CREATE_DEV_RDS=1
REFRESH_RDS_ADMIN_IP=1
SETUP_RESUME=0
SETUP_START_AT=
SETUP_STOP_AFTER=
SETUP_ONLY=
```

Then run `bash infra/init/aws-setup.sh`.

If you do not use `infra/init/aws-setup.sh`, create the same resources manually.
Also install the same host tools on EC2 and verify Compose before deploying:

```bash
sudo dnf update -y
sudo dnf install -y docker git awscli amazon-ssm-agent jq curl
sudo systemctl enable --now docker amazon-ssm-agent
sudo usermod -aG docker ec2-user
docker compose version
```

Example trust policy for the GitHub deploy role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:optimalcharb/pdf-ner:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

The deploy workflows currently create a temporary Compose override on EC2 that
sets the selected service image to the new ECR image tag. This keeps
`infra/docker-compose.yml` usable for manual local builds while CI/CD can deploy
prebuilt images.

## Cloudflare

Create a Cloudflare API token before running the setup scripts. Scope it to the
target account and zone with these permissions:

- Account `Cloudflare Tunnel` Edit
- Zone `DNS` Edit
- Zone `WAF` Write

Setup flow:

1. Run `infra/cloudflare/setup-waf/setup-waf-free.sh` (Free plan) or
   `infra/cloudflare/setup-waf/setup-waf-pro.sh` (Pro+ plan) to create or update
   zone WAF rules. The default `WAF_MODE=monitor` observes traffic; use `enforce`
   only when you are ready to block matching requests.
2. Run `infra/cloudflare/setup-tunnel/setup-tunnel.sh` to create or update the
   remote-managed Tunnel, remote ingress config, and proxied CNAME DNS records
   for `PUBLIC_HOSTNAMES`.
3. Copy the printed `TUNNEL_TOKEN` into the EC2 bootstrap environment and run
   `infra/aws/bootstrap-ec2/bootstrap-ec2.sh`.
4. Trigger GitHub Actions `Deploy Stack` to start the app.

The Cloudflare API token and `TUNNEL_TOKEN` are local/bootstrap inputs in the
current flow. They are not GitHub Actions secrets.

SES domain authentication is separate from app DNS. If you verify the whole sending domain in SES, AWS will provide DNS records for DKIM and domain verification. Add those exact records in Cloudflare. Keep SES verification and DKIM records DNS only.

## Stripe

The current app uses Stripe for payment method collection and card charging, while subscription state and usage billing are recorded in Postgres.

Current billing behavior from `web/public/chatbot-knowledge/billing.md`:

- Account creation requires payment information immediately.
- Stripe SetupIntents save a payment method without charging on signup.
- Individual accounts are charged `$10 + LLM usage`.
- Organization accounts are charged `$10 per user + LLM usage`.
- Workers create off-session PaymentIntents when accounts are due.
- Stripe Billing Subscriptions are intentionally not used, to avoid Stripe Billing fees.

Stripe setup checklist:

1. Create or use a Stripe account.
2. Complete business profile, public details, payout bank account, tax details, and production activation.
3. Add `STRIPE_SECRET_KEY` to `prod/web` and `prod/workers`.
4. Add `VITE_STRIPE_PUBLISHABLE_KEY` to `infra/.env.prod`; this is a public browser key.
5. In Stripe Dashboard, enable the payment methods you want to support.
6. Keep card collection on the Payment Element backed by SetupIntents.
7. Use PaymentIntents for monthly off-session charges from the worker.
8. Use idempotency keys for every worker-created PaymentIntent.
9. Add the production domain to Stripe settings where required for wallets and embedded payment surfaces.
10. Test failed cards, required authentication, disputes, refunds, and payment method replacement.

Important launch blocker:

- The local billing summary and code pin Stripe API version `2026-04-22.dahlia`.
- Current Stripe docs list `2026-02-25.clover` as the current API version.
- Before going live, reconcile this in `web/src/lib/stripe.server.ts`, `workers/app/domains/billing/application/workflows.py`, and Stripe Workbench.

Webhook note:

- The current summarized billing flow does not depend on Stripe Billing webhooks.
- Consider adding a webhook endpoint later for asynchronous PaymentIntent state changes, disputes, refunds, and payment method events.
- If you add webhooks, create the endpoint with the same API version used by the app and store the signing secret in Secrets Manager.

## First Production Smoke Test

After DNS, certificates, env vars, and Compose are ready:

1. Visit `https://dokumenai.dev`.
2. Create a new account.
3. Save a payment method through the billing page.
4. Verify a Stripe Customer and SetupIntent were created.
5. Confirm Postgres has the Stripe customer ID, payment method ID, billing start date, and next payment date.
6. Upload an avatar and verify the object appears in the avatar S3 bucket.
7. Create a PDF bucket and upload a small PDF.
8. Run the worker billing task in test mode or against a test account due date.
