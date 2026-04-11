# Summary

- The deployment change set adds first-pass containerization for `db`, `redis`, `api`, `worker`, and `web`, but there are several correctness and security gaps against `DEPLOY.md`, especially around exposed ports, missing env vars, and Python build reproducibility (`infra/docker-compose.yml:1-101`, `api/Dockerfile:1-36`, `workers/Dockerfile:1-44`, `db/Dockerfile:1-14`, `web/Dockerfile:1-25`).
- The most immediate deployment blockers are: `workers/.env.local.example` is missing required worker settings, `api/.env.local.example` is missing `STRIPE_SECRET_KEY`, the worker Docker build uses `uv sync --frozen` with no `workers/uv.lock`, and the API Docker build does not copy the existing `api/uv.lock` before running `uv sync --frozen` (`workers/app/core/config.py:13-23`, `workers/.env.local.example:1`, `api/app/core/config.py:16-31`, `api/.env.local.example:1-16`, `workers/Dockerfile:14-19`, `api/Dockerfile:9-14`).
- I could not execute Docker or test commands in this environment because shell execution was blocked by policy. Findings below are based on the checked-in files only.

# Service Composition

- The compose file defines all five intended services and wires `api`/`worker` to `db` and `redis` with health-gated startup (`infra/docker-compose.yml:1-97`). That matches the broad multi-service intent in `DEPLOY.md`.
- `DEPLOY.md` describes the `api` container as optionally exposed via Nginx, but `infra/docker-compose.yml` always publishes `8000:8000` (`DEPLOY.md:165-171`, `infra/docker-compose.yml:45-46`). That is a deployment-policy mismatch.
- The architecture section in `DEPLOY.md` says containers communicate over Docker's internal network using service names, but the compose file also publishes `db` and `redis` directly to the host (`DEPLOY.md:173-174`, `infra/docker-compose.yml:17-18`, `infra/docker-compose.yml:29-30`). That undermines the "internal-only" model.

# Security

- `db`, `redis`, `api`, and `web` all publish service ports to the host, including database and cache ports (`infra/docker-compose.yml:17-18`, `infra/docker-compose.yml:29-30`, `infra/docker-compose.yml:45-46`, `infra/docker-compose.yml:81-82`). On EC2 this makes them reachable beyond the reverse proxy unless security groups are tightened perfectly.
- The `web` image runs as root. Unlike `api` and `worker`, it never creates or switches to a non-root user (`web/Dockerfile:17-25`, compare `api/Dockerfile:19-29` and `workers/Dockerfile:29-39`).
- The build images pull unpinned "latest" tooling: `ghcr.io/astral-sh/uv:latest` in both Python images and `dbmate` from GitHub's latest-release URL in the DB image (`api/Dockerfile:4`, `workers/Dockerfile:4`, `db/Dockerfile:4-7`). That weakens supply-chain reproducibility and makes rebuilds non-deterministic.
- Secrets are passed as plain environment variables into containers, including all role passwords and third-party keys (`infra/docker-compose.yml:5-14`, `infra/docker-compose.yml:49-51`, `infra/docker-compose.yml:66-67`, `infra/docker-compose.yml:83-93`). That is common in Compose, but there is no stronger secret-handling mechanism here.

# Build Efficiency

- `api/Dockerfile` runs `uv sync --frozen` after copying only `pyproject.toml` (`api/Dockerfile:9-10`), but the repo's lockfile is `api/uv.lock` and it is never copied into the image context before dependency resolution. That is likely to fail or at minimum drop lockfile reproducibility.
- `workers/Dockerfile` also runs `uv sync --frozen` (`workers/Dockerfile:15`, `workers/Dockerfile:19`), but there is no `workers/uv.lock` file in the repo. This is a likely build breaker.
- `web/Dockerfile` uses a multi-stage build, which is good, but it copies the entire source tree before `bun run build` (`web/Dockerfile:8-14`). That is standard, but it means any app-source change invalidates the build stage after dependency install.
- The DB image installs `curl` only to fetch `dbmate` and leaves the downloaded binary in place without checksum verification (`db/Dockerfile:4-8`). Image size impact is small, but build trust and repeatability are the larger concerns.

# Environment Variables

- `workers/.env.local.example` only contains `REDIS_URL` (`workers/.env.local.example:1`), but worker settings require `WORKERS_DATABASE_URL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, and `STRIPE_SECRET_KEY` as mandatory values (`workers/app/core/config.py:16-23`). `docker-compose.yml` only supplies `WORKERS_DATABASE_URL` and `REDIS_URL` (`infra/docker-compose.yml:63-67`), so a deploy following `DEPLOY.md` will still start with missing required worker env vars.
- `api/.env.local.example` includes API key, LLM keys, and AWS keys, but it does not include the required `STRIPE_SECRET_KEY` from API settings (`api/.env.local.example:1-16`, `api/app/core/config.py:16-31`). `infra/docker-compose.yml` also does not inject `STRIPE_SECRET_KEY` into `api` (`infra/docker-compose.yml:47-57`). That is another likely runtime startup failure.
- `DEPLOY.md` tells the operator to copy `workers/.env.local.example` and `api/.env.local.example` into `.env` files and fill them out (`DEPLOY.md:57-66`), but the checked-in examples are incomplete for the actual required settings above. This is a direct doc-to-config mismatch.

# Health Checks

- `db` and `redis` have compose-level health checks (`infra/docker-compose.yml:19-24`, `infra/docker-compose.yml:34-38`), and `api`/`worker` define Dockerfile health checks (`api/Dockerfile:33-34`, `workers/Dockerfile:41-42`).
- `web` has no health check in either the Dockerfile or compose file (`web/Dockerfile:1-25`, `infra/docker-compose.yml:75-97`). That leaves the front-end service without readiness/liveness signaling.
- The worker health check only verifies Redis connectivity (`workers/Dockerfile:41-42`); it does not verify broker consumers, Celery boot success, or database reachability. That may be too weak for production health semantics.

# Networking

- There is no explicit `networks:` section in `infra/docker-compose.yml` (`infra/docker-compose.yml:1-101`). Compose will create a default shared network, but there is no isolation between public-facing and private services.
- Publishing `5432` and `6379` to the host conflicts with the internal-network architecture described in `DEPLOY.md` (`DEPLOY.md:173-174`, `infra/docker-compose.yml:17-18`, `infra/docker-compose.yml:29-30`).
- Publishing `3000` is consistent with the Nginx reverse-proxy example, but if Nginx is the intended public entrypoint then `8000`, `5432`, and `6379` should not be host-published by default (`DEPLOY.md:90-133`, `infra/docker-compose.yml:45-46`).

# Gaps vs DEPLOY.md

- `DEPLOY.md` says the DB image is "PostgreSQL 18 + dbmate" and that startup runs `init/01_roles.sh` then `init/02_migrate.sh` (`DEPLOY.md:71-76`). The Dockerfile and compose wiring do support that (`db/Dockerfile:1-14`, `infra/docker-compose.yml:2-25`).
- `DEPLOY.md` expects `docker compose ... up -d --build` to produce a working deployment (`DEPLOY.md:67-84`), but the checked-in env examples and Python Dockerfiles are not internally consistent enough to support that reliably because of the missing worker/API env vars and the `uv --frozen` lockfile issues (`api/Dockerfile:9-14`, `workers/Dockerfile:14-19`, `api/.env.local.example:1-16`, `workers/.env.local.example:1`).
- `DEPLOY.md` recommends Nginx as the public entrypoint (`DEPLOY.md:90-133`), but the compose defaults expose multiple backend services directly. The docs and compose should agree on whether those services are intentionally public or strictly internal.
