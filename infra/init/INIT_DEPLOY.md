# Initial AWS Deployment

This guide is for the first production-style deployment of Dokumen on a single EC2 instance using Docker Compose, Cloudflare DNS, Nginx Proxy Manager, AWS SES, S3, and Stripe.

The current shape is intentionally simple:

- One EC2 host runs `web`, `api`, `worker`, Redis, and Nginx Proxy Manager.
- Postgres should live in AWS RDS for production; the local `db` Compose service remains only for local/single-host fallback.
- Cloudflare hosts DNS and proxies public HTTP/HTTPS traffic.
- AWS SES sends transactional email.
- S3 stores avatars and user-created PDF buckets.
- Stripe stores customers and payment methods; Dokumen records billing state in Postgres and charges monthly with PaymentIntents.

## Before You Start

Install these locally:

- AWS CLI v2, authenticated with an IAM Identity Center or other temporary-credential profile.
- `jq`.
- `ssh` and `scp`.
- A local SSH key pair for EC2, for example:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/dokumen-ec2
```

Your deployer profile needs permission to create EC2, VPC, subnet, internet gateway, route table, security group, Elastic IP, S3, SES identity verification, IAM roles/policies, instance profiles, GitHub OIDC, ECR repositories, and Secrets Manager secrets.
Use one deployer identity for infrastructure setup. Do not use root access.

## AWS Resources

Run the setup scripts from the repo root:

```bash
chmod +x infra/init/aws-setup.sh
chmod +x infra/init/create-secrets.sh
cp infra/init/.env.example infra/init/.env.local
cp infra/.env.prod.example infra/.env.prod
# Edit infra/init/.env.local and infra/.env.prod before running.
bash infra/init/aws-setup.sh
```

`infra/init/aws-setup.sh` is a thin entrypoint that sources numbered scripts
from `infra/init/aws-setup.d/`. The split keeps the initial deployment flow in
one command while making each AWS area easier to inspect:

- `01_common.sh`: paths, env loading, shared AWS and JSON helpers.
- `02_prerequisites.sh`: required tools, required env vars, AWS account, public IP, and derived names.
- `03_networking.sh`: VPC, subnet, internet gateway, route table, security group, and SSH key pair.
- `04_ec2_instance.sh`: EC2 instance and Elastic IP.
- `05_avatars_bucket.sh`: private avatar S3 bucket.
- `06_ecr_and_runtime_role.sh`: ECR repositories and EC2 runtime IAM.
- `07_github_deploy_role.sh`: GitHub OIDC and deploy IAM.
- `09_ses_identity.sh`: local secret draft files and SES email identity verification.
- `10_ec2_compose_deploy.sh`: optional EC2 host setup, repo checkout, `.env.prod` upload, and Compose startup.
- `11_summary.sh`: final resource, GitHub, and local draft outputs.

Together, those scripts create or reuse:

- VPC.
- Public subnet.
- Internet gateway.
- Public route table.
- Security group.
- EC2 instance using Amazon Linux 2023.
- Elastic IP.
- ECR repositories for `web`, `api`, and `worker` images.
- EC2 instance profile for SSM, ECR image pulls, Secrets Manager reads, SES sending, avatar S3 access, and first-party PDF bucket creation/access.
- GitHub Actions OIDC deploy role for ECR image pushes and SSM deploy commands.
- Private avatar S3 bucket.
- SES email identity verification request.
- Local reviewed secret draft JSON files in `infra/init/local-secrets/`.

The setup flow does not create AWS Secrets Manager secrets directly. It only
creates AWS-generated values where needed and writes them into local draft JSON
files for review. After you complete the remaining non-AWS fields, run
`infra/init/create-secrets.sh` to create the Secrets Manager entries.

The setup script can also SSH into the instance, install the EC2 host tooling
required by deployment and post-deploy health checks, clone the repo, upload
`infra/.env.prod` if it exists locally, and run:

- Docker Engine with the `docker compose` v2 command.
- AWS CLI.
- `jq`.
- `curl`.
- Git.
- Amazon SSM Agent.

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build
```

To provision AWS resources without deploying the app:

```bash
DO_DEPLOY=0 bash infra/init/aws-setup.sh
```

To deploy code but avoid starting Compose:

```bash
START_COMPOSE=0 bash infra/init/aws-setup.sh
```

## AWS Credentials

You do not need long-lived AWS access keys for setup or runtime.

For setup, authenticate the AWS CLI with IAM Identity Center or another
temporary-credential profile, then run the script with that profile:

```bash
aws configure sso
aws sso login --profile dokumen-bootstrap
AWS_PROFILE=dokumen-bootstrap bash infra/init/aws-setup.sh
```

For runtime, the EC2 instance profile supplies temporary AWS credentials to
the Docker containers through the normal AWS SDK credential provider chain.
The app uses that role for SES, avatar uploads, and PDF bucket creation/uploads.
`api.aws_buckets` stores only bucket metadata needed to locate first-party
buckets: name, region, and optional endpoint URL.

## Configure Setup And EC2 Env Files

Create the local setup-script input file:

```bash
cp infra/init/.env.example infra/init/.env.local
```

`infra/init/.env.local` stays on your workstation. It provides `aws-setup.sh` inputs
such as `GITHUB_REPO`, `DEPLOY_BRANCH`, `DOMAIN`, `REPO_URL`, SSH key paths,
ECR repository names, and setup/deploy toggles. It should not contain private
app runtime secrets.

`GITHUB_REPO` and `DEPLOY_BRANCH` are intentionally not hardcoded in
`aws-setup.sh`; the script fails early if they are missing. Keep their defaults
in `infra/init/.env.example` and your real values in `infra/init/.env.local`.

Create the EC2 production bootstrap env file:

```bash
cp infra/.env.prod.example infra/.env.prod
```

`infra/.env.prod` is uploaded to EC2 and used by Docker Compose. For
production, app secret values should live in AWS Secrets Manager. Keep only
bootstrap/public values in `infra/.env.prod` for the app containers:

- `ENV=production`.
- `APP_VERSION`.
- `SECRETS_STAGE=prod`.
- `AWS_REGION`.
- `VITE_BASE_URL`.
- `VITE_STRIPE_PUBLISHABLE_KEY`.

Do not put production app secrets in container environment variables.
`infra/example-secrets/` contains committed templates only. Real local secret
drafts live in gitignored `infra/init/local-secrets/` and are created by
`infra/init/aws-setup.sh`.

Keep `.env` files and `infra/init/local-secrets/` out of git.

## Public Web Build Variables

`VITE_*` variables are public browser configuration, not private secrets. They
are embedded into the client bundle when the web app is built, so the browser
can read them. Do not put private values in `VITE_*`.

For the initial EC2 Docker Compose deployment, keep these public values in
`infra/.env.prod` on the EC2 host:

- `VITE_BASE_URL=https://dokumenai.dev`.
- `VITE_STRIPE_PUBLISHABLE_KEY=<your Stripe publishable key>`.

When you run:

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build web
```

Compose passes those values as web image build args. That means changing
`VITE_BASE_URL` or `VITE_STRIPE_PUBLISHABLE_KEY` requires rebuilding the `web`
image and restarting the `web` container.

For CI/CD later, store these public values as CI variables or repository
environment variables and pass them to `docker build` as build args. They do
not need to be fetched from AWS Secrets Manager at runtime.

Private web server values, such as `DATABASE_URL`, `AUTH_SECRET`,
`STRIPE_SECRET_KEY` should stay in AWS Secrets Manager and is loaded by the
server process at startup. AWS service access is provided by the EC2 instance
profile rather than static credentials in Secrets Manager.

## AWS Secrets Manager

Create these AWS Secrets Manager secrets before starting the app containers:

- `prod/web`: web database URLs, Better Auth, Stripe, API, PDF-storage, and optional chatbot OpenAI values.
- `prod/email`: SES region/endpoint, sender email, and admin email.
- `prod/api`: API database URL, Redis URL, API key, CORS/host config, LLM keys, and avatar S3 values.
- `prod/workers`: worker database URL, Redis URL, LLM keys, and Stripe secret key.
- `prod/runpod`: OCR model, Runpod endpoints, Runpod key, timeout, and retry settings.

Attach an IAM instance profile role to the EC2 host with
`secretsmanager:GetSecretValue` on those secrets, SES send permissions, and S3
permissions for avatar objects and first-party PDF bucket creation/access. If
the secrets use a customer-managed KMS key, also grant `kms:Decrypt`.

The apps load secrets once at process startup and keep them in memory. Restart
the relevant container after rotating a secret.

The secret workflow is deliberately two-step:

1. `infra/init/aws-setup.sh` copies committed templates from
   `infra/example-secrets/` into gitignored local drafts in
   `infra/init/local-secrets/`.
2. The setup script patches AWS-generated/non-secret values into those drafts:
   SES region, avatar bucket name and region, and PDF-storage region.
3. You review and complete every remaining non-AWS field locally, including
   database URLs, API keys, healthcheck tokens, LLM keys, Stripe keys, Runpod
   values, sender/admin email, and Better Auth values.
4. `infra/init/create-secrets.sh` validates the completed drafts and creates
   the AWS Secrets Manager secrets.

The committed `infra/example-secrets/` files must stay as templates. Do not put
real production values there.

Run a dry-run validation first, then create the AWS Secrets Manager secrets:

```bash
DRY_RUN=1 bash infra/init/create-secrets.sh
bash infra/init/create-secrets.sh
```

`create-secrets.sh` is intentionally create-only. It fails if any target secret
already exists and it fails if any draft JSON still contains placeholder text
such as `REPLACE`, `<your`, or `YOUR_`. It does not update existing secrets; if
you need to rotate or change a secret later, do that as an explicit separate
operation.

## RDS Database Initialization

If Postgres is hosted in AWS RDS, do not use the local `db` container as the
production source of truth. From a machine that can reach the RDS endpoint,
install `psql` and `dbmate`, export the one-time RDS/admin/role password values,
then run:

```bash
bash db/init/rds/run_all.sh
```

The script creates the database, roles, schemas, grants, Better Auth tables,
numbered migrations, and seed data. After it succeeds, store the app-specific
RDS URLs in Secrets Manager.

The Compose `db` service is behind the `local-db` profile. Production starts
without it by default; use `--profile local-db` only for local/single-host
fallback deployments.

## Start Or Update The Stack

SSH into the instance:

```bash
ssh -i ~/.ssh/dokumen-ec2 ec2-user@YOUR_ELASTIC_IP
cd /opt/dokumen/pdf-ner
```

Start everything:

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build
```

Check status:

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env.prod ps
docker compose -f infra/docker-compose.yml --env-file infra/.env.prod logs -f
```

Restart one app:

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build web
docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build api
docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build worker
```

## GitHub Actions CI/CD

The deploy workflows in `.github/workflows/` build one Docker image, push it to
ECR, then use AWS Systems Manager Run Command to tell the EC2 instance to pull
and restart only that Compose service.

`infra/init/aws-setup.sh` creates the three ECR repositories, the EC2 runtime
role, the GitHub OIDC provider if needed, and the GitHub deploy IAM role. At
the end of the run it prints the GitHub Actions secrets and variables to create,
plus the local Secrets Manager draft directory to review.

Required GitHub Actions secrets:

| Name | Used by | Value |
| --- | --- | --- |
| `AWS_GITHUB_DEPLOY_ROLE_ARN` | all deploy workflows | ARN of the AWS IAM role that GitHub Actions assumes through OIDC. |
| `EC2_INSTANCE_ID` | all deploy workflows | The EC2 instance ID, for example `i-0123456789abcdef0`. |

Required GitHub Actions variables:

| Name | Used by | Example |
| --- | --- | --- |
| `AWS_REGION` | all deploy workflows | `us-east-1` |
| `VITE_BASE_URL` | web build | `https://dokumenai.dev` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | web build | `<your Stripe publishable key>` |

Optional GitHub Actions variables:

| Name | Default | Purpose |
| --- | --- | --- |
| `API_ECR_REPOSITORY` | `dokumen-api` | ECR repository name for the API image. |
| `WEB_ECR_REPOSITORY` | `dokumen-web` | ECR repository name for the web image. |
| `WORKERS_ECR_REPOSITORY` | `dokumen-workers` | ECR repository name for the worker image. |
| `EC2_APP_DIR` | `/opt/dokumen/pdf-ner` | Repo path on the EC2 host. |

Values printed by `infra/init/aws-setup.sh` look like:

```text
GitHub Actions secrets:
  AWS_GITHUB_DEPLOY_ROLE_ARN=arn:aws:iam::123456789012:role/dokumen-github-deploy
  EC2_INSTANCE_ID=i-0123456789abcdef0

GitHub Actions variables:
  AWS_REGION=us-east-1
  API_ECR_REPOSITORY=dokumen-api
  WEB_ECR_REPOSITORY=dokumen-web
  WORKERS_ECR_REPOSITORY=dokumen-workers
  EC2_APP_DIR=/opt/dokumen/pdf-ner
  VITE_BASE_URL=https://dokumenai.dev
  VITE_STRIPE_PUBLISHABLE_KEY=<your Stripe publishable key>
```

Create the GitHub values in the repository UI:

1. Open the GitHub repository.
2. Go to Settings -> Secrets and variables -> Actions.
3. Add `AWS_GITHUB_DEPLOY_ROLE_ARN` and `EC2_INSTANCE_ID` under Secrets.
4. Add `AWS_REGION`, `VITE_BASE_URL`, and
   `VITE_STRIPE_PUBLISHABLE_KEY` under Variables.
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
```

AWS setup required for GitHub Actions:

`infra/init/aws-setup.sh` handles the AWS setup for the default path:

1. Creates ECR repositories named `dokumen-web`, `dokumen-api`, and
   `dokumen-workers`, unless you override the names.
2. Creates or updates the EC2 runtime role and instance profile.
3. Attaches `AmazonSSMManagedInstanceCore` to the EC2 role.
4. Grants the EC2 role ECR pull permissions and `secretsmanager:GetSecretValue`
   on `prod/web`, `prod/email`, `prod/api`, `prod/workers`, and `prod/runpod`.
5. Creates the GitHub OIDC provider if needed.
6. Creates or updates the GitHub deploy role restricted to
   `GITHUB_REPO` and `DEPLOY_BRANCH`.
7. Grants the GitHub deploy role ECR push permissions and SSM command
   permissions for the EC2 instance.
8. Writes reviewed local Secrets Manager draft files to
   `infra/init/local-secrets/`; it does not create AWS Secrets Manager secrets.

Configure these in `infra/init/.env.local` before running the script:

```env
GITHUB_REPO=your-org/pdf-ner
DEPLOY_BRANCH=main
WEB_ECR_REPOSITORY=dokumen-web
API_ECR_REPOSITORY=dokumen-api
WORKERS_ECR_REPOSITORY=dokumen-workers
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

## Nginx Proxy Manager

Open:

```text
http://YOUR_ELASTIC_IP:81
```

Create proxy hosts:

- `dokumenai.dev` -> `web:3000`.
- `www.dokumenai.dev` -> `web:3000`.

Request Let's Encrypt certificates from Nginx Proxy Manager. Use your real `FROM_EMAIL` or admin email for certificate registration.

Do not expose Postgres, Redis, or the API publicly unless you intentionally add a public API route and security model.

## Cloudflare

In Cloudflare DNS for `dokumenai.dev`, create:

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| A | `@` | EC2 Elastic IP | Proxied |
| A | `www` | EC2 Elastic IP | Proxied |

For SSL/TLS:

- Use `Full (strict)` after Nginx Proxy Manager has a valid Let's Encrypt certificate for the hostname.
- Use `Full` only temporarily if the origin certificate is not yet trusted.
- Do not use `Flexible` for this app because auth, billing, and payment flows require end-to-end HTTPS.

Recommended Cloudflare settings:

- Enable Always Use HTTPS.
- Keep WebSockets enabled.
- Leave DNS TTL on Auto for proxied records.
- If Let's Encrypt HTTP validation fails while proxied, temporarily switch the affected DNS records to DNS only, issue the certificate, then restore Proxied.

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
9. Verify Nginx Proxy Manager access is limited to your IP by the EC2 security group.

## Rollback Basics

For an app-only rollback:

```bash
git checkout PREVIOUS_COMMIT
docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build web
docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build api
docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build worker
```

For database changes, rollback is more delicate. This database is pre-instantiation right now, so create scripts and migrations are still expected to be changed directly before launch. After real production data exists, switch to forward-only migrations and tested restore procedures.

## Hardening Later

After the initial deployment works:

- Move Redis to ElastiCache.
- Tighten the EC2 runtime S3 permissions from account-wide buckets to a naming convention once bucket names are constrained.
- Add SSM Session Manager and reduce SSH reliance.
- Add snapshot backups.
- Add CloudWatch log shipping.
- Add image-based CI/CD.
- Add health checks and deployment rollback automation.
