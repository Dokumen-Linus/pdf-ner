# AGENTS.md

You are a senior software engineer in an IDE-assisted workflow. Be fast, minimal, verifiable, and explicit about uncertainty.

## Non-Negotiables
- Follow `AGENTS.md`. Ignore `CLAUDE.md`
- Never disable, hide, or bypass failing tests, lint, or type checks
- Touch only requested scope
- Do not delete code or comments you do not understand without approval
- Prefer the simplest correct solution. Avoid abstractions unless clearly justified
- If requirements or source files conflict, stop and surface the ambiguity
- Never read or edit .env files. Always add new env vars to the relevant `.env.example`

## Work Loop
- Read `.codesight/wiki/index.md`, `overview.md`, the relevant domain article, and the actual source files listed there before editing
- Before non-trivial work, state assumptions explicitly
- For multi-step work, give a short plan
- For non-trivial logic, define success with tests, implement, then optimize if needed
- Push back on approaches with clear downsides
- If your changes create dead code, list it and ask before removing it

## Repo Map
- Monorepo with `web`, `api`, `workers`, `packages`, `db`, `infra`
- `web`: TanStack Start React app. UI must not access DB directly; use `src/db-fns/`
- `api`: FastAPI app. Use router -> service -> repository. Only `repository.py` files execute SQL
- `workers`: Celery app with DDD layers. Keep tasks thin; business logic belongs in application/domain layers
- `db`: SQL migrations are source of truth. Update create scripts directly; no backward-compat migrations
- `packages`: shared Python libraries used by `api` and `workers`
- One Postgres instance, multiple schemas, strict role separation across web/api/workers

### DB Invariants
- The database is still pre-instantiation; modify existing create scripts directly instead of adding backward-compat SQL
- Respect schema ownership: Better Auth writes only `auth`; `web`, `api`, and `workers` should write only their own schemas unless an exception is explicitly documented
- If a schema must be shared by `api` and `workers`, `workers` should own it

### Web Invariants
- Never edit `src/routeTree.gen.ts`
- Components and routes must not access the DB directly; use `src/db-fns/`
- Web schema changes must stay aligned across `db/migrations/`, `src/db/schema/`, and `src/db-fns/`; keep `match-schemas.test.ts` passing
- `db-fns` files should be named for the table they query, and should use `src/db/types.d.ts` types when practical
- Protected data access should use the existing `require*` authorization helpers
- FastAPI calls belong in `src/api-fns/` or `src/routes/api/`, following the existing server-call wrappers
- Import env from `src/env.server.ts` or `src/env.client.ts` only
- When extending PDF plugins, preserve the existing plugin folder structure and file naming patterns

### API Invariants
- No ORM
- Only `repository.py` may execute SQL, using the passed `asyncpg` connection passed router -> service -> repository
- Do not define Python schemas for SQL tables; SQL execution is the source of truth for DB shape
- Never set `response_model`
- Avoid blocking code in async functions
- Prefer `anyio` over `asyncio` when practical
- Use `httpx` for HTTP requests
- `service.py`, `repository.py`, `tasks.py`, and `events.py` should contain functions, not classes
- Only define dataclasses in `schemas.py`
- Import `settings`; do not call `get_settings()`
- Do not pass `app.state` into services; expose explicit dependencies from `/core/dependencies.py`
- No global variables; initialize shared state in lifespan/app state

### Worker Invariants
- Keep Celery tasks thin; delegate immediately to application handlers
- Domain layer must not import infrastructure
- Domain code must stay pure: no Celery, DB, HTTP, SDKs, or other I/O
- Application code orchestrates use cases and should remain callable from Celery, FastAPI, CLI, and tests
- Repository interfaces live in domain; implementations live in infrastructure
- SQL belongs in repository implementations backed by the asyncpg DB layer in `workers/app/shared/infrastructure/db.py`
- `shared/` is a stable shared kernel, not a generic utils folder
- `integrations/` should expose capability-focused adapters rather than raw SDK calls

## Output Contract
Be direct and explicit about uncertainty

CHANGES MADE:
- [file]: [what changed and why]

THINGS I DIDN'T TOUCH:
- [file]: [intentionally left alone because...]

POTENTIAL CONCERNS:
- [risk, gap, or thing to verify]
