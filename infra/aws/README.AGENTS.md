# Deploy AWS Scripts

This directory is the replacement flow for initial AWS deployment. It is intentionally separate from `infra/init` and split by stage.

## Run Order

Run these stages from the repository root, in this order:

1. `networking/setup-networking.sh`
2. `database/setup-databases.sh`
3. `ec2/setup-ec2-stack.sh`
4. `create-secrets.sh`
5. `ci/ci-on-ec2.sh`
6. `deploy/deploy-on-ec2.sh`

Each stage loads only its own `.env.local` beside the script, except `create-secrets.sh`, which loads `infra/deploy-aws/.env.local`. Example inputs live beside each stage as `.env.example`.

## Stage Responsibilities

- `networking/setup-networking.sh` creates or reuses the main app VPC, public/private subnets, internet gateway, public/private route tables, NAT gateways, EC2 security group, SSH key pair, and VPC flow logs. It uses `ADMIN_CIDR` directly and does not discover or refresh the caller IP.
- `database/setup-databases.sh` creates or reuses the production RDS instance in the app VPC private subnets and the development RDS instance in a separate public dev VPC. It does not create the Postgres database, roles, schemas, migrations, seed data, or tables.
- `ec2/setup-ec2-stack.sh` runs the EC2 setup pieces: app ECR repositories, EC2 instance profile, and EC2 instance with Elastic IP. It creates only the `web`, `api`, and `workers` ECR repositories.
- `create-secrets.sh` creates AWS Secrets Manager secrets from reviewed local JSON drafts in `local-secrets`.
- `ci/ci-on-ec2.sh` prepares the EC2 host packages, optionally installs a GitHub deploy key, and checks out the repo.
- `deploy/deploy-on-ec2.sh` uploads the production bootstrap env if present, builds with Docker Compose from the prepared checkout, and runs `infra/health/ec2-healthcheck.sh`.

## Outputs

Generated resource information is written under `outputs/` as stage-specific `.env` and report files. These files are output artifacts only; the scripts rediscover resources by AWS names and tags rather than reading previous output files.

Secret drafts live under `local-secrets/`. The database stage copies the example draft files if missing and patches only the production database URLs in the web, api, and workers draft files.

## Explicit Non-Scope

These scripts do not configure later public ingress work, repository automation roles, SES identity verification, avatar bucket creation, GPU image repositories, or database schema deployment.

Database schema and seed work remains in `db/deploy-rds`.
