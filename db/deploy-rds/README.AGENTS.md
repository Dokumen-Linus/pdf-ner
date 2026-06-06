# RDS Deployment Scripts

## Scope

- These scripts create the RDS database, roles, schemas, grants, migrations, seed data, and smoke-checks for the Dokumen database
- These scripts do not create AWS RDS instances, VPCs, subnets, or security groups. Create those first with `infra/aws/setup-database/setup-databases.sh`
- Run from the repository root unless you have verified all relative paths

## How to Run

Create .env file, load env vars, and run:

```bash
set -a
source db/deploy-rds/.env.production # or .env.development
set +a
bash db/deploy-rds/run_all.sh
```

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
- A complete run ends with `RDS health checks passed.`
