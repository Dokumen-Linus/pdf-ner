# `otel_py`

`otel_py` is the shared observability toolkit for this repo. It provides the low-level building blocks used by the Python apps, but it does not own application-specific telemetry policy.

## Ownership

### What belongs in `packages/otel_py`

Put code here when it is generic, reusable, and safe for multiple Python apps to share.

Examples:

- Context storage helpers such as `bind_context()`, `clear_context()`, and `get_context_value()`
- Trace extraction and injection helpers
- Generic metrics primitives and metric recording helpers
- Generic operation instrumentation such as:
  - `record_http_request()`
  - `record_celery_task_event()`
  - `record_llm_call()`
  - `observe_postgres_operation()`
  - `observe_redis_operation()`
- Shared logging formatters and logging setup primitives
- Shared semantic metric names and observability config types

`otel_py` should stay application-agnostic. It should not know about FastAPI routes, Celery task wiring, specific domain concepts, or repo-specific HTTP endpoints.

### What belongs in `api/app/core/telemetry.py`

Put code here when it is specific to the FastAPI service boundary.

Examples:

- Declaring the API service identity (`dokumen-api`)
- Binding request-scoped context for incoming HTTP traffic
- Extracting trace headers from FastAPI requests
- Building Celery headers from the current API request context
- Exposing `/healthz`, `/readyz`, and `/metrics`
- API-specific wrappers around shared helpers, such as `record_api_http_request()`
- Any logic that depends on FastAPI request objects, middleware behavior, or API app state

This file is where shared observability primitives are adapted to the API runtime.

### What belongs in `workers/app/core/telemetry.py`

Put code here when it is specific to the Celery worker boundary.

Examples:

- Declaring the worker service identity (`dokumen-workers`)
- Binding worker/task-scoped context
- Wiring Celery lifecycle signals
- Recording worker-ready gauges
- Recording task lifecycle events with task-specific metadata
- Any logic that depends on Celery request headers, retry/failure hooks, or worker process state

This file is where shared observability primitives are adapted to the worker runtime.

## What should not move into `otel_py`

Do not put these in `otel_py`:

- FastAPI middleware classes
- FastAPI routers for health or metrics endpoints
- Celery signal registration that assumes this repo’s worker layout
- Service names like `dokumen-api` or `dokumen-workers`
- Route labeling policy, request header policy, or task header policy for one app only
- Domain-specific labels that only make sense in one service

If code needs to know which app it is running in, it usually belongs in the app layer, not in `otel_py`.

## Shared libraries such as `packages/llm_providers`

Shared packages should usually not own telemetry configuration.

Good uses:

- Returning data that lets the app record telemetry
- Calling a narrow shared helper if it is fully generic and caller-driven

Avoid:

- Configuring logging
- Declaring service identity
- Exporting metrics endpoints
- Inventing app-level labels inside the library

In practice, app code in `api/` and `workers/` should remain the main place where telemetry is attached, because that is where request IDs, task IDs, route templates, and other runtime context are known.

## Relationship to `logging.py`

Each app has a thin `logging.py` wrapper:

- `api/app/core/logging.py`
- `workers/app/core/logging.py`

Those files should stay small. Their job is only to expose app-local logging setup in a clean import path.

Current pattern:

- `api/app/core/logging.py` calls `configure_api_logging()`
- `workers/app/core/logging.py` calls `configure_worker_logging()`
- Those functions live in each app’s `telemetry.py`
- The app-level telemetry function then calls `otel_py.configure_logging(...)` with the correct service-specific config

This layering keeps responsibilities clear:

1. `otel_py` defines how logging is formatted and configured.
2. `api/app/core/telemetry.py` and `workers/app/core/telemetry.py` decide which service config to use.
3. Each app’s `logging.py` provides a minimal, stable entry point for app startup code.

## Rule of thumb

Use this test before adding code:

- If it is reusable across Python services without knowing app details, put it in `otel_py`.
- If it depends on FastAPI runtime details, put it in `api/app/core/telemetry.py`.
- If it depends on Celery runtime details, put it in `workers/app/core/telemetry.py`.
- If it is only a tiny startup wrapper, keep it in the app’s `logging.py`.
