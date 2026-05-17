# RDS Deployment Scripts

## Scope

- These scripts create the RDS database, roles, schemas, grants, migrations, seed data, and smoke-checks for the Dokumen database.
- These scripts do not create AWS RDS instances, VPCs, subnets, or security groups. Create those first with `infra/init/create-prod-rds.sh` and/or `infra/init/create-dev-rds.sh`.
- Run from the repository root unless you have verified all relative paths.
- Do not read or edit `.env` files. Use `.env.example` as the documented variable list and provide real values through your shell or secret manager.

## Prerequisites

- The target RDS instance must already exist and be reachable from the machine running these scripts.
- `psql` must be installed and able to reach the RDS host.
- `dbmate` must be installed locally.
- The RDS admin user must be allowed to create the target database and roles.
- Export the required variables listed in `db/deploy-rds/.env.example`.

## Relationship To `infra/init`

Run both script groups for a fresh deployment:

1. `infra/init/aws-setup.sh` creates the app VPC, EC2 host, ECR repos, IAM roles, S3 bucket, SES identity request, and local secret drafts.
2. `infra/init/create-prod-rds.sh` creates or updates `dokuprod` in the app VPC, with Postgres access from the EC2 security group and optional current-IP admin access.
3. `infra/init/create-dev-rds.sh` creates or updates `dokudev` in a separate public dev VPC, restricted to your current public `/32`.
4. `db/deploy-rds/run_all.sh` initializes the actual Postgres database objects on whichever RDS endpoint `RDS_HOST` points to.

Run `db/deploy-rds/run_all.sh` once for `dokuprod` and once for `dokudev` if both instances should have the Dokumen schema and seed data.

## Standard Run

```bash
set -a
source db/deploy-rds/.env.example
set +a
bash db/deploy-rds/run_all.sh
```

Replace the example values before running. Never put real passwords in committed files.

For `dokuprod`, set `RDS_HOST` to the endpoint printed by `infra/init/create-prod-rds.sh`.
For `dokudev`, set `RDS_HOST` to the endpoint printed by `infra/init/create-dev-rds.sh`.

## Script Order

1. `01_create_database_roles_schemas.sh` creates the database if needed, creates or updates roles, creates schemas, and applies schema/default privileges.
2. `02_migrate_seed.sh` runs Better Auth setup, dbmate migrations, top-level seed SQL, and `standard_entity_types` seed SQL.
3. `03_healthcheck.sh` connects directly as each app role with its own password and verifies key tables and privileges.

## Restarting After Failure

- Better Auth setup is intentionally a one-time block. If `02_migrate_seed.sh` fails because auth tables or indexes already exist, comment out the lines between:
  - `BEGIN ONE-TIME BETTER AUTH SETUP`
  - `END ONE-TIME BETTER AUTH SETUP`
- Then rerun `bash db/deploy-rds/run_all.sh`.
- Do not disable failing migrations, seeds, or health checks. Fix the underlying SQL or privilege issue.

## Expected Success Signal

- A complete run ends with `RDS health checks passed.`
