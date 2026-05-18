# Initial AWS Deployment

This guide is for the first production-style deployment of Dokumen on a single EC2 instance using Docker Compose, Cloudflare DNS, Nginx Proxy Manager, AWS SES, S3, and Stripe.

The current shape is intentionally simple:

- One EC2 host runs `web`, `api`, `worker`, Redis, and Nginx Proxy Manager.
- Postgres should live in AWS RDS for production; the local `db` Compose service remains only for local/single-host fallback.
- Cloudflare hosts DNS and proxies public HTTP/HTTPS traffic.
- AWS SES sends transactional email.
- S3 stores avatars and user-created PDF buckets.
- Stripe stores customers and payment methods; Dokumen records billing state in Postgres and charges monthly with PaymentIntents.

## Run Order Overview

Use this order for the first deployment.

1. In the AWS Console, using root only for this bootstrap if needed, create the
   setup identity you will actually use for deployment, for example
   `init-deployer`.
2. Create or attach a customer-managed IAM policy based on
   `infra/init/init-deployer-policy.json` to that setup identity.
3. Log out of root. Authenticate the local AWS CLI as the setup identity, not
   root. With IAM Identity Center this usually means:

```bash
aws configure sso --profile init-deployer
aws sso login --profile init-deployer
export AWS_PROFILE=init-deployer
```

4. Create local input files from the examples, then edit the local copies:

```bash
cp infra/init/.env.example infra/init/.env.local
cp infra/.env.prod.example infra/.env.prod
```

5. Run the infrastructure setup. For the safest first pass, create AWS resources
   without starting the app containers yet:

```bash
DO_DEPLOY=0 bash infra/init/aws-setup.sh
```

6. Review the generated state and draft secret files:

- `infra/init/local-state/aws-setup.state`: shell-readable non-secret values
  from the setup scripts, such as resource IDs, ARNs, endpoints, selected public
  config, and completed step markers.
- `infra/init/local-state/aws-setup.report.txt`: human-readable summary of the
  same non-secret setup state plus resume commands.
- `infra/init/local-secrets/*.json`: local, gitignored AWS Secrets Manager draft
  JSON files. These can contain real secret values after you complete them.

7. If your workstation public IP changed after `aws-setup.sh` created the RDS
   security groups, refresh local RDS admin ingress:

```bash
bash infra/init/authorize-rds-admin-ip.sh
```

8. Bootstrap the RDS databases and database roles using the `db/deploy-rds`
   flow. This needs the RDS endpoints from `infra/init/local-state/` and the
   passwords you chose locally.
9. Create the fixed Runpod OCR Pods so their endpoint URLs can be saved into
   the `prod/runpod` secret draft. From `infra/runpod/.env.example`, create
   `infra/runpod/.env.local`, set `CREATE_PODS=1`, leave both Pod IDs blank for
   the first run, and set `AWS_REGION`, an immutable `IMAGE_TAG`,
   `RUNPOD_API_KEY`, `OCR_HTTP_BEARER_TOKEN`, and optional `HF_TOKEN`.

```bash
bash infra/runpod/deploy_all.sh
```

   After the first run, save the printed Pod IDs in `infra/runpod/.env.local`
   and use `CREATE_PODS=0` for later deploys.
10. Complete the remaining draft files in `infra/init/local-secrets/`.
11. Validate the completed AWS Secrets Manager draft files:

```bash
DRY_RUN=1 bash infra/init/create-secrets.sh
```

12. Create the AWS Secrets Manager secrets:

```bash
bash infra/init/create-secrets.sh
```

13. Deploy the EC2 app stack after the required secrets exist:

```bash
SETUP_ONLY=ec2-deployment bash infra/init/aws-setup.sh
```

14. Create the printed Cloudflare DNS records.
15. Complete SES identity verification.
16. Configure Nginx Proxy Manager.
17. Set the printed GitHub Actions secrets.
18. Set the printed GitHub Actions variables.

## Before You Start

Install these locally:

- AWS CLI v2, authenticated with an IAM Identity Center or other temporary-credential profile.
- `jq`.
- `ssh` and `scp`.
- `psql` and `dbmate` for the later `db/deploy-rds` database bootstrap step.
- A local SSH key pair for EC2, for example:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/dokumen-ec2
```

Your deployer profile needs permission to create EC2, VPC, subnet, internet gateway, route table, security group, Elastic IP, RDS instances, RDS subnet groups, S3, SES identity verification, IAM roles/policies, instance profiles, GitHub OIDC, ECR repositories, and Secrets Manager secrets.
Use one deployer identity for infrastructure setup. Do not use root access.

## AWS Resources

Run the setup scripts from the repo root:

```bash
chmod +x infra/init/aws-setup.sh
chmod +x infra/init/create-secrets.sh
chmod +x infra/init/authorize-rds-admin-ip.sh
cp infra/init/.env.example infra/init/.env.local
cp infra/.env.prod.example infra/.env.prod
# Edit infra/init/.env.local and infra/.env.prod before running.
bash infra/init/aws-setup.sh
```

`infra/init/aws-setup.sh` is a thin entrypoint that sources numbered scripts
from `infra/init/aws-setup.d/`. It prints start/finish timing around each
top-level step. The split keeps the initial deployment flow in one command
while making each AWS area easier to inspect:

- `01_common.sh`: paths, env loading, step logging, shared AWS, RDS
  ingress, and JSON helpers.
- `02_prerequisites.sh`: required tools, required env vars, AWS account, public IP, and derived names.
- `03_networking.sh`: VPC, two public subnets, internet gateway, route table, security group, and SSH key pair.
- `04_ec2_instance.sh`: EC2 instance and Elastic IP.
- `05_avatars_bucket.sh`: private avatar S3 bucket.
- `06_ecr_and_runtime_role.sh`: ECR repositories and EC2 runtime IAM.
- `07_github_deploy_role.sh`: GitHub OIDC and deploy IAM.
- `08_prod_rds.sh`: production RDS subnet group, security group, instance, and optional DB URL draft updates.
- `09_dev_rds.sh`: separate development RDS VPC, networking, security group, subnet group, and instance.
- Shared RDS admin ingress refresh: after RDS setup, `aws-setup.sh` refreshes
  current-IP PostgreSQL ingress for the prod/dev RDS security groups.
- `10_ses_identity.sh`: local secret draft files and SES email identity verification.
- `11_ec2_compose_deploy.sh`: optional EC2 host setup, repo checkout, `.env.prod` upload, and Compose startup.
- `12_summary.sh`: final resource, GitHub, and local draft outputs.

The entrypoint is resumable and decomposable. It writes non-secret resource
state after every step, and also on errors, to gitignored local files:

- `infra/init/local-state/aws-setup.state`: shell-readable state for later runs.
- `infra/init/local-state/aws-setup.report.txt`: human-readable IDs, endpoints,
  completed steps, and resume commands.

The state file intentionally stores resource IDs, ARNs, endpoints, selected
public config, and step markers only. It must not store RDS passwords, app role
passwords, API keys, Stripe keys, or other app secrets.

Together, those scripts create or reuse:

- VPC.
- Two public subnets in separate Availability Zones.
- Internet gateway.
- Public route table.
- Security group.
- EC2 instance using Amazon Linux 2023.
- Elastic IP.
- ECR repositories for `web`, `api`, `worker`, `deepseek-ocr`, and `olm-ocr2` images.
- EC2 instance profile for SSM, ECR image pulls, Secrets Manager reads, SES sending, avatar S3 access, and first-party PDF bucket creation/access.
- GitHub Actions OIDC deploy role for ECR image pushes and SSM deploy commands.
- Production RDS instance in the app VPC.
- Development RDS instance in a separate public dev VPC.
- Current-IP RDS admin ingress for the prod/dev RDS security groups.
- Private avatar S3 bucket.
- SES email identity verification request.
- Local reviewed secret draft JSON files in `infra/init/local-secrets/`.

RDS creation runs from the main setup entrypoint by default:

- `08_prod_rds.sh` creates or reuses `dokuprod` in the app VPC.
  It creates the production DB subnet group and RDS security group, allows
  PostgreSQL from the EC2 app security group, and can also allow your current
  public `/32` for local administration.
- `09_dev_rds.sh` creates or reuses `dokudev` in a separate public dev VPC.
  It allows PostgreSQL only from your current public `/32`.
- `aws-setup.sh` runs the same current-IP PostgreSQL ingress refresh after
  RDS setup, removing stale local `/32` CIDRs from the managed prod/dev RDS
  security groups.
- `infra/init/authorize-rds-admin-ip.sh` remains as a small maintenance
  entrypoint for the same refresh when your workstation IP changes later.

Set `CREATE_PROD_RDS=0` or `CREATE_DEV_RDS=0` in `infra/init/.env.local` to
skip either RDS step during setup.
Set `REFRESH_RDS_ADMIN_IP=0` to skip the automatic RDS admin-IP refresh inside
`aws-setup.sh` or the standalone helper.

The setup flow does not create AWS Secrets Manager secrets directly. It only
creates AWS-generated values where needed and writes them into local draft JSON
files for review. After you complete the remaining non-AWS fields, run
`infra/init/create-secrets.sh` to create the Secrets Manager entries.

The setup script can also SSH into the instance, install the EC2 host tooling
required by deployment and post-deploy health checks, clone the repo, upload
`infra/.env.prod` if it exists locally, and run:

- Docker Engine with the `docker compose` and `docker buildx` v2 plugins.
- AWS CLI.
- `jq`.
- `curl`.
- Git.
- Amazon SSM Agent.

Amazon Linux 2023 installs `curl-minimal` by default; use that existing `curl`
binary instead of installing the conflicting full `curl` package.

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

To run only the first two setup steps and save enough state to continue later:

```bash
SETUP_STOP_AFTER=networking bash infra/init/aws-setup.sh
```

If a later step fails, fix the issue and resume at the first incomplete step:

```bash
SETUP_RESUME=1 bash infra/init/aws-setup.sh
```

To start from, stop after, or run exactly one step, use these controls:

```bash
SETUP_START_AT=prod-rds bash infra/init/aws-setup.sh
SETUP_STOP_AFTER=prod-rds bash infra/init/aws-setup.sh
SETUP_ONLY=prod-rds bash infra/init/aws-setup.sh
```

Valid step IDs are `prerequisites`, `networking`, `ec2-instance`,
`avatar-bucket`, `ecr-runtime-iam`, `github-deploy-iam`, `prod-rds`,
`dev-rds`, `rds-admin-ingress`, `secrets-ses`, `ec2-deployment`, and
`summary`.

## AWS Credentials

You do not need long-lived AWS access keys for setup or runtime.

For setup, authenticate the AWS CLI with IAM Identity Center or another
temporary-credential profile, then run the script with that profile:

```bash
aws configure sso
aws sso login --profile init-deployer
AWS_PROFILE=init-deployer bash infra/init/aws-setup.sh
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
ECR repository names, setup/deploy toggles, and optional RDS bootstrap values.
It should not contain private app runtime secrets.

`GITHUB_REPO` and `DEPLOY_BRANCH` are intentionally not hardcoded in
`aws-setup.sh`; the script fails early if they are missing. Keep their defaults
in `infra/init/.env.example` and your real values in `infra/init/.env.local`.
`07_github_deploy_role.sh` creates AWS IAM/OIDC permissions for GitHub Actions;
it does not create GitHub credentials for EC2. For a private repo, create a
GitHub read-only deploy key and set `GITHUB_DEPLOY_KEY_PATH` to the local
private key path before running the EC2 deployment step.

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

Keep `.env` files, `infra/init/local-secrets/`, and
`infra/init/local-state/` out of git.

For RDS creation, either export the RDS master passwords in your shell before
running `infra/init/aws-setup.sh`, or keep them in your local uncommitted
`infra/init/.env.local`:

```env
PROD_RDS_MASTER_PASSWORD=<strong prod master password>
DEV_RDS_MASTER_PASSWORD=<strong dev master password>
```

If you also set the app role passwords in `infra/init/.env.local`,
the production RDS setup step patches the local Secrets Manager draft JSON
files with production database URLs:

```env
OWNER_ROLE_PASSWORD=<owner role password>
AUTH_ROLE_PASSWORD=<auth role password>
WEB_USER_PASSWORD=<web role password>
API_USER_PASSWORD=<api role password>
WORKERS_USER_PASSWORD=<workers role password>
```

Use the same role password values when running `db/deploy-rds/run_all.sh`.

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
   SES region, avatar bucket name and region, PDF-storage region, and
   production RDS URLs if app role passwords are available in the local
   environment.
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

You will run `infra/init/aws-setup.sh` and `db/deploy-rds` for a fresh RDS
deployment. The split is deliberate:

- `infra/init` creates AWS infrastructure: VPC/subnets/routes/security groups,
  RDS instances, DB subnet groups, IAM, ECR, EC2, S3, SES, and secret drafts.
- `db/deploy-rds` connects to an existing RDS endpoint and creates the
  PostgreSQL database, roles, schemas, grants, migrations, seeds, and direct
  app-role health checks.

Create or update the AWS resources, including production and development RDS
by default:

```bash
bash infra/init/aws-setup.sh
```

`dokuprod` is created in the app VPC. Its RDS security group allows PostgreSQL
from the EC2 app security group so the Docker Compose apps keep database
access through normal VPC networking. If `PROD_RDS_ALLOW_LOCAL_ADMIN=1`, the
script also allows your current public `/32` for local `psql` and `dbmate`
bootstrap. Set `CREATE_PROD_RDS=0` to skip this step.

`dokudev` is created in a separate public dev VPC and is accessible only from
your current public `/32` using normal Postgres credentials and
`sslmode=require`. RDS IAM database authentication is not enabled. Set
`CREATE_DEV_RDS=0` to skip this step.

`aws-setup.sh` refreshes the current-IP admin ingress by default after the RDS
steps. If your workstation IP changes later, refresh the same RDS admin
ingress rules without rerunning the full setup:

```bash
bash infra/init/authorize-rds-admin-ip.sh
```

After each RDS instance exists, run the database bootstrap against its endpoint.
From a machine that can reach the RDS endpoint, install `psql` and `dbmate`,
export the one-time RDS/admin/role password values, then run:

```bash
export RDS_HOST=<endpoint printed by infra/init/aws-setup.sh>
export RDS_PORT=5432
export RDS_DB=dokumen
export RDS_ADMIN_DB=postgres
export RDS_ADMIN_USER=postgres
export PGPASSWORD=<matching RDS master password>
export PGSSLMODE=require

export OWNER_ROLE_PASSWORD=<owner role password>
export AUTH_ROLE_PASSWORD=<auth role password>
export WEB_USER_PASSWORD=<web role password>
export API_USER_PASSWORD=<api role password>
export WORKERS_USER_PASSWORD=<workers role password>

bash db/deploy-rds/run_all.sh
```

Run `db/deploy-rds/run_all.sh` once for `dokuprod` and once for `dokudev` if
both instances should contain the Dokumen schema and seed/reference data.

The script creates or updates the `dokumen` database, roles, schemas, grants,
Better Auth tables, numbered migrations, and seed data. Its health check
connects directly as each app role using its own password, which verifies the
same credential path used by web, API, and workers.

After `dokuprod` succeeds, create or update the app-specific RDS URLs in AWS
Secrets Manager. If the production RDS setup step had the app role passwords
available, it already patched the local draft JSON files in
`infra/init/local-secrets/`; review those drafts and run
`infra/init/create-secrets.sh` when ready.

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
| `GPU_DEEPSEEK_ECR_REPOSITORY` | `dokumen-deepseek-ocr` | ECR repository name for the DeepSeek OCR image. |
| `GPU_OLM_OCR2_ECR_REPOSITORY` | `dokumen-olm-ocr2` | ECR repository name for the olmOCR2 image. |
| `DEEPSEEK_RUNPOD_POD_ID` | `(none)` | Fixed Runpod pod ID for DeepSeek OCR. |
| `OLM_OCR2_RUNPOD_POD_ID` | `(none)` | Fixed Runpod pod ID for olmOCR2. |
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
  GPU_DEEPSEEK_ECR_REPOSITORY=dokumen-deepseek-ocr
  GPU_OLM_OCR2_ECR_REPOSITORY=dokumen-olm-ocr2
  DEEPSEEK_RUNPOD_POD_ID=<fixed-deepseek-pod-id>
  OLM_OCR2_RUNPOD_POD_ID=<fixed-olm-pod-id>
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
gh variable set GPU_DEEPSEEK_ECR_REPOSITORY --body "dokumen-deepseek-ocr"
gh variable set GPU_OLM_OCR2_ECR_REPOSITORY --body "dokumen-olm-ocr2"
gh variable set DEEPSEEK_RUNPOD_POD_ID --body "<fixed-deepseek-pod-id>"
gh variable set OLM_OCR2_RUNPOD_POD_ID --body "<fixed-olm-pod-id>"
gh variable set EC2_APP_DIR --body "/opt/dokumen/pdf-ner"
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
