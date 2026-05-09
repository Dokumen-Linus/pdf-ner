# otel_py

## Ownership

- Context storage helpers
- Trace extraction and injection helpers
- Generic metrics primitives and recording helpers
- Generic operation instrumentation helpers for HTTP, Celery, LLM, Postgres, and Redis operations
- Shared logging formatters and logging setup primitives
- Shared semantic metric names and observability config types

## Belongs in App Telemetry

- FastAPI-specific service identity, request context binding, request header extraction, health/ready/metrics endpoints, middleware behavior, and app-state-dependent logic belong in `api/app/core/telemetry.py`
- Celery-specific service identity, task context binding, signal wiring, worker gauges, task lifecycle labels, and worker process state belong in `workers/app/core/telemetry.py`

## Do Not Put in `otel_py`

- FastAPI middleware classes
- FastAPI routers
- Celery signal registration that assumes this repo's worker layout
- Service names such as `dokumen-api` or `dokumen-workers`
- Route labeling policy, request header policy, or task header policy for one app only
- Domain-specific labels that only make sense in one service

## Rule of Thumb

- If it is reusable across Python services without app details, put it in `otel_py`
- If it depends on FastAPI runtime details, put it in API telemetry
- If it depends on Celery runtime details, put it in worker telemetry
- If it is only a tiny startup wrapper, keep it in the app's `logging.py`
