# RDS Deployment Scripts

## Scope

- These scripts create the RDS database, roles, schemas, grants, migrations, seed data, and smoke-checks for the Dokumen database.
- Run from the repository root unless you have verified all relative paths.
- Do not read or edit `.env` files. Use `.env.example` as the documented variable list and provide real values through your shell or secret manager.

## Prerequisites

- `psql` must be installed and able to reach the RDS host.
- `dbmate` must be installed locally.
- The RDS admin user must be allowed to create the target database and roles.
- Export the required variables listed in `db/deploy-rds/.env.example`.

## Standard Run

```bash
set -a
source db/deploy-rds/.env.example
set +a
bash db/deploy-rds/run_all.sh
```

Replace the example values before running. Never put real passwords in committed files.

## Script Order

1. `01_create_database_roles_schemas.sh` creates the database if needed, creates or updates roles, creates schemas, and applies schema/default privileges.
2. `02_migrate_seed.sh` runs Better Auth setup, dbmate migrations, top-level seed SQL, and `standard_entity_types` seed SQL.
3. `03_healthcheck.sh` connects as each app role and verifies key tables and privileges.

## Restarting After Failure

- Better Auth setup is intentionally a one-time block. If `02_migrate_seed.sh` fails because auth tables or indexes already exist, comment out the lines between:
  - `BEGIN ONE-TIME BETTER AUTH SETUP`
  - `END ONE-TIME BETTER AUTH SETUP`
- Then rerun `bash db/deploy-rds/run_all.sh`.
- Do not disable failing migrations, seeds, or health checks. Fix the underlying SQL or privilege issue.

## Expected Success Signal

- A complete run ends with `RDS health checks passed.`
