# health

- Purpose: verify each app (`web`, `api`, and `workers`), app Redis connectivity through ElastiCache, ElastiCache metadata, and optionally AWS secrets
- Run separately after deploys; deploy workflows must not invoke this automatically
- Supports SSM or SSH execution on the EC2 instance

## `.env.example` Variables

- `APP_DIR`: absolute path on the EC2 to the partial repo clone containing `infra/docker-compose.yml` and `infra/.env.prod` (not the deployed image dir)
- `EC2_INSTANCE_ID`: EC2 instance ID targeted by `push-healthcheck.sh`; if blank, the script resolves a running instance by `INSTANCE_NAME`.
- `INSTANCE_NAME`: EC2 `Name` tag used by `push-healthcheck.sh` when `EC2_INSTANCE_ID` is blank.
- `COMPOSE_FILE`: path to `infra/docker-compose.yml`, which must not contain local Redis or Postgres.
- `ENV_FILE`: path to `infra/.env.prod` non-secret env vars copied to EC2 and loaded by Compose
- `REQUIRED_SERVICES`: space-separated Compose services required
- `OPTIONAL_SERVICES`: space-separated Compose services that don't fail check if missing
- `HOST_PORT_CHECKS`: space-separated `label:host:port` TCP probes. A closed required host port fails the check.
- `CHECK_ELASTICACHE`: `1` enables ElastiCache replication group checks
- `ELASTICACHE_REPLICATION_GROUP_ID`: replication group expected to back Redis
- `CHECK_AWS_SECRETS`: `1` verifies the named AWS Secrets Manager secrets exist
- `CHECK_SECRET_UNPACK`: `1` runs container-level checks that JSON secrets unpack into required API/workers env vars
- `AWS_SECRET_NAMES`: space-separated secret names checked when `CHECK_AWS_SECRETS=1`.
- `CHECK_PUBLIC_TUNNEL`: `1` probes public web `/api/healthz` and `/api/readyz` through Cloudflare Tunnel
- `CHECK_CLOUDFLARE_ORIGIN`: `1` verifies there are no public host listeners on ports 80/443 and runs the local origin probe
- `PUBLIC_HEALTH_BASE_URL`: public base URL used when `CHECK_PUBLIC_TUNNEL=1`
- `REQUIRE_WEB_LOCAL_CHECK`: `1` makes the local web health probe fail when unavailable
- `WEB_LOCAL_URL`: local web health URL used for the optional Cloudflare origin probe
- `LOG_LINES`: number of recent log lines included per service when health checks fail
