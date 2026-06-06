# RDS Modification Scripts

## Scope

- Purpose: apply existing dbmate migrations or explicit seed files to an already-created RDS database
- This directory does not create RDS instances, databases, roles, schemas, grants, seeds, or health checks
- Use `db/deploy-rds/run_all.sh` for full bootstrap; use the modify scripts here only when the database is already bootstrapped and you only need pending migrations or explicit extra seeds

## How to Run

From the repository root:

```bash
bash db/modify-rds/run-new-migrations-dev.sh
```

```bash
bash db/modify-rds/run-new-migrations-prod.sh
```

Run a specific additional seed:

```bash
bash db/modify-rds/run-new-seeds-dev.sh db/seeds/source_providers.sql
```

```bash
bash db/modify-rds/run-new-seeds-prod.sh db/seeds/standard_entity_types/legal.sql
```

The script name selects which default env file to load:

- `*-dev.sh` loads `db/modify-rds/.env.development` when present, otherwise `db/deploy-rds/.env.development`
- `*-prod.sh` loads `db/modify-rds/.env.production` when present, otherwise `db/deploy-rds/.env.production`

Set `RDS_DEPLOY_ENV_FILE` to override the env file path explicitly:

```bash
RDS_DEPLOY_ENV_FILE=db/deploy-rds/.env.local bash db/modify-rds/run-new-migrations-dev.sh
```

The same override works for seeds:

```bash
RDS_DEPLOY_ENV_FILE=db/modify-rds/.env.development bash db/modify-rds/run-new-seeds-dev.sh db/seeds/source_providers.sql
```

## Required Env Vars

The selected env file must define:

- `RDS_HOST`: PostgreSQL host. For production, use the private RDS endpoint; production scripts run from EC2 through SSM so private DNS resolves inside the VPC
- `RDS_ADMIN_USER`: deploy/admin PostgreSQL user that can `SET ROLE owner_role`
- `PGPASSWORD`: password for `RDS_ADMIN_USER`

Optional env vars:

- `RDS_PORT`: PostgreSQL port; defaults to `5432`
- `RDS_DB`: database name; defaults to `dokumen`
- `PGSSLMODE`: PostgreSQL SSL mode; defaults to `require`

Production env vars:

- `AWS_REGION`: AWS region; defaults to `us-east-1`
- `PROJECT_NAME`: project tag prefix; defaults to `dokumen`
- `ENVIRONMENT`: tag environment; defaults to `production`
- `INSTANCE_NAME`: EC2 Name tag to resolve when `EC2_INSTANCE_ID` is not set; defaults to `dokumen-ec2`
- `EC2_INSTANCE_ID`: optional explicit production EC2 instance id
- `EC2_APP_DIR`: production app directory on EC2; defaults to `/opt/dokumen/pdf-ner`
- `USE_SSH_FALLBACK`: set to `1` only when SSM is unavailable and SSH is necessary
- `SSH_PRIVATE_KEY_PATH`: private key path for SSH fallback
- `SSH_USER`: SSH username for fallback; defaults to `ec2-user`

`db/modify-rds/.env.example` documents the required subset from `db/deploy-rds/.env.local.example` plus production remote-execution settings.

## Migration Behavior

- Verifies `dbmate` is installed for dev, or on EC2 for prod
- Refuses to run if any migration filenames share the same numeric version prefix before the first underscore
- Verifies the selected database already exists by connecting to `RDS_DB`
- Refuses to run unless `public.schema_migrations` already exists and has at least one applied migration
- Verifies the deploy user can `SET ROLE owner_role`
- Runs `dbmate --migrations-dir=db/migrations up` with `options=-c role=owner_role`
- Does not execute arbitrary SQL files
- Does not run Better Auth setup, seed SQL, or health checks

The dev migration script runs locally against public dev RDS. The prod migration script sends the local `db/migrations` directory to EC2 and runs `dbmate up` there so private production RDS DNS and routing work inside the VPC.

`dbmate up` reads the full `db/migrations` directory, but it only applies migrations that are not already recorded in `public.schema_migrations`.

Dbmate treats the numeric prefix before the first underscore as the migration version. New timestamped migrations should use `YYYYMMDDhhmmss_description.sql`, not `YYYYMMDD_hhmmss_description.sql`, so the full timestamp is the dbmate version.

## Additional Seeds

Use the seed scripts for additional seed SQL files. Seeds are not tracked by dbmate, so these scripts require one explicit `.sql` file under `db/seeds` and never run the full seeds directory.

Seed behavior:

- Verifies the selected database already exists by connecting to `RDS_DB`
- Refuses to run unless `public.schema_migrations` already exists and has at least one applied migration
- Runs the selected seed with `psql -v ON_ERROR_STOP=1`
- Does not run dbmate migrations
- Does not run Better Auth setup or health checks

The dev seed script runs locally. The prod seed script sends the selected local seed SQL file to EC2 and runs `psql` there.
