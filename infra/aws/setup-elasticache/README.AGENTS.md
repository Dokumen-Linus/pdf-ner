# setup-elasticache

- Purpose: create or update the ElastiCache for Redis OSS resources used by api and workers
- Executed by: `infra/aws/setup-elasticache/setup-elasticache.sh`
- Depends on: resources from `infra/aws/setup-networking/setup-networking.sh`
- Idempotent
- Set `EXISTING_ELASTICACHE_AUTH_TOKEN_CONFIRMED=1` if the replication group already exists and you know the true token
- Outputs: `DOKUMEN_REDIS_ELASTICACHE_URL`, `API_REDIS_URL`, `WORKERS_REDIS_URL`, `API_ELASTICACHE_AUTH_TOKEN`, `WORKERS_ELASTICACHE_AUTH_TOKEN`
