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

- AWS CLI v2, authenticated with deployer credentials.
- `jq`.
- `ssh` and `scp`.
- A local SSH key pair for EC2, for example:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/dokumen-ec2
```

Your deployer AWS credentials need permission to create EC2, VPC, subnet, internet gateway, route table, security group, Elastic IP, S3, SES identity verification, and IAM users/policies/access keys.

Use one deployer identity for infrastructure setup. Do not use root access keys.

## AWS Resources

Run the setup script from the repo root:

```bash
chmod +x infra/aws-setup.sh
cp infra/.env.local.example infra/.env.local
cp infra/.env.prod.example infra/.env.prod
# Edit infra/.env.local and infra/.env.prod before running.
bash infra/aws-setup.sh
```

The script creates or reuses:

- VPC.
- Public subnet.
- Internet gateway.
- Public route table.
- Security group.
- EC2 instance using Amazon Linux 2023.
- Elastic IP.
- ECR repositories for `web`, `api`, and `worker` images.
- EC2 instance profile for SSM, ECR image pulls, and Secrets Manager reads.
- GitHub Actions OIDC deploy role for ECR image pushes and SSM deploy commands.
- Private avatar S3 bucket.
- IAM user and access key for SES sending.
- IAM user and access key for avatar S3 access.
- IAM user and access key for PDF-storage S3 bucket creation and access.
- SES email identity verification request.

The script can also SSH into the instance, install Docker, clone the repo,
upload `infra/.env.prod` if it exists locally, and run:

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build
```

To provision AWS resources without deploying the app:

```bash
DO_DEPLOY=0 bash infra/aws-setup.sh
```

To deploy code but avoid starting Compose:

```bash
START_COMPOSE=0 bash infra/aws-setup.sh
```

## AWS Access Keys

You do not need a separate AWS access key for EC2, VPC, subnets, DNS-related networking, gateways, route tables, security groups, Elastic IPs, or IAM resources. Those are infrastructure resources created by your deployer credentials through the AWS CLI.

You should separate runtime credentials by application capability:

- `SES_AWS_ACCESS_KEY_ID` and `SES_AWS_SECRET_ACCESS_KEY` for web email sending.
- `AVATARS_AWS_ACCESS_KEY_ID` and `AVATARS_AWS_SECRET_ACCESS_KEY` for API avatar uploads.
- `PDF_STORAGE_AWS_ACCESS_KEY_ID` and `PDF_STORAGE_AWS_SECRET_ACCESS_KEY` for creating and using user PDF buckets.

On AWS, IAM roles with temporary credentials are preferred for EC2 workloads. The current app, however, persists per-bucket S3 credentials in Postgres for PDF storage, so long-lived scoped keys are still part of the current design. Treat that as a later hardening target.

## Configure Setup And EC2 Env Files

Create the local setup-script input file:

```bash
cp infra/.env.local.example infra/.env.local
```

`infra/.env.local` stays on your workstation. It provides `aws-setup.sh` inputs
such as `GITHUB_REPO`, `DEPLOY_BRANCH`, `DOMAIN`, `REPO_URL`, SSH key paths,
ECR repository names, and setup/deploy toggles. It should not contain private
app runtime secrets.

`GITHUB_REPO` and `DEPLOY_BRANCH` are intentionally not hardcoded in
`aws-setup.sh`; the script fails early if they are missing. Keep their defaults
in `infra/.env.local.example` and your real values in `infra/.env.local`.

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

Do not put production app secrets in container environment variables. Use the
JSON files in `infra/example-secrets/` as the source material for AWS Secrets
Manager.

Keep `.env` files out of git.

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
`STRIPE_SECRET_KEY`, SES credentials, and API storage credentials, should stay
in AWS Secrets Manager and are loaded by the server process at startup.

## AWS Secrets Manager

Create these JSON secrets before starting the app containers:

- `prod/web`: web database URLs, Better Auth, Stripe, API, PDF-storage, and optional chatbot OpenAI values.
- `prod/email`: SES credentials, SES region/endpoint, sender email, and admin email.
- `prod/api`: API database URL, Redis URL, API key, CORS/host config, LLM keys, and avatar S3 values.
- `prod/workers`: worker database URL, Redis URL, LLM keys, and Stripe secret key.
- `prod/runpod`: OCR model, Runpod endpoints, Runpod key, timeout, and retry settings.

Attach an IAM instance profile role to the EC2 host with
`secretsmanager:GetSecretValue` on those secrets. If the secrets use a
customer-managed KMS key, also grant `kms:Decrypt`.

The apps load secrets once at process startup and keep them in memory. Restart
the relevant container after rotating a secret.

Example JSON payloads live in `infra/example-secrets/`. Use them as templates
for the five AWS Secrets Manager secrets; replace every placeholder before
production.

Create or update the secrets from those files with:

```bash
aws secretsmanager create-secret --name prod/web --secret-string file://infra/example-secrets/prod-web.json
aws secretsmanager create-secret --name prod/email --secret-string file://infra/example-secrets/prod-email.json
aws secretsmanager create-secret --name prod/api --secret-string file://infra/example-secrets/prod-api.json
aws secretsmanager create-secret --name prod/workers --secret-string file://infra/example-secrets/prod-workers.json
aws secretsmanager create-secret --name prod/runpod --secret-string file://infra/example-secrets/prod-runpod.json
```

If a secret already exists, update it instead:

```bash
aws secretsmanager put-secret-value --secret-id prod/web --secret-string file://infra/example-secrets/prod-web.json
aws secretsmanager put-secret-value --secret-id prod/email --secret-string file://infra/example-secrets/prod-email.json
aws secretsmanager put-secret-value --secret-id prod/api --secret-string file://infra/example-secrets/prod-api.json
aws secretsmanager put-secret-value --secret-id prod/workers --secret-string file://infra/example-secrets/prod-workers.json
aws secretsmanager put-secret-value --secret-id prod/runpod --secret-string file://infra/example-secrets/prod-runpod.json
```

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

`infra/aws-setup.sh` creates the three ECR repositories, the EC2 runtime role,
the GitHub OIDC provider if needed, and the GitHub deploy IAM role. At the end
of the run it prints the exact GitHub Actions secrets and variables to create.

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

Values printed by `infra/aws-setup.sh` look like:

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

`infra/aws-setup.sh` handles the AWS setup for the default path:

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

Configure these in `infra/.env.local` before running the script:

```env
GITHUB_REPO=your-org/pdf-ner
DEPLOY_BRANCH=main
WEB_ECR_REPOSITORY=dokumen-web
API_ECR_REPOSITORY=dokumen-api
WORKERS_ECR_REPOSITORY=dokumen-workers
```

Then run `bash infra/aws-setup.sh`.

If you do not use `infra/aws-setup.sh`, create the same resources manually.

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
- Replace long-lived runtime access keys with instance roles where the app design allows it.
- Add SSM Session Manager and reduce SSH reliance.
- Add snapshot backups.
- Add CloudWatch log shipping.
- Add image-based CI/CD.
- Add health checks and deployment rollback automation.
