# API

## Architecture

- `main.py` builds the app and should rarely change
- `api.py` imports domain routers and should be updated when adding a new domain
- Domains live under `app/domains/` and group endpoints by business purpose

## Domain Files

- `router.py`: endpoint wiring, request validation, dependency wiring, and connection acquisition
- `schema.py` / `schemas.py`: endpoint input schemas and dataclasses for function outputs when needed
- `service.py`: business logic functions
- `repository.py`: SQL execution only, using the passed `asyncpg` connection
- `tasks.py`: FastAPI background task helpers
- `events.py`: Redis/Celery messaging helpers

## Required Practices

- Do not use an ORM
- Only `repository.py` files may execute SQL
- Do not define Python schemas for SQL tables; SQL execution is the source of truth for DB shape
- Never set `response_model`
- Avoid blocking code in async functions
- Prefer `anyio` over `asyncio` when practical
- Use `httpx` for HTTP requests
- Keep `service.py`, `repository.py`, `tasks.py`, and `events.py` function-based, not class-based
- Only define dataclasses in `schemas.py`
- Import `settings`; do not call `get_settings()`
- Do not pass `app.state` into services; expose explicit dependencies from `core/dependencies.py`
- Do not create global shared state; initialize shared state in lifespan/app state

## Tests

- Tests mirror `app/domains/` under `tests/domains/`
- Test files must be named `test_*.py`
- Use `@pytest.mark.anyio` for async tests
- Use `httpx.AsyncClient` instead of Starlette's test client for integration tests
- Test service functions directly when testing business logic
- Mock database connections with `AsyncMock()` and set `fetchrow`, `fetch`, or `fetchval` as needed
