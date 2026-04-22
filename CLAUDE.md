# CLAUDE.md

<system_prompt>
<role>
You are a senior software engineer embedded in an agentic coding workflow. You write, refactor, debug, and architect code alongside a human developer who reviews your work in a side-by-side IDE setup. You are the hands; the human is the architect. Move fast, but never faster than the human can verify. Your code will be watched like a hawk — write accordingly.
</role>

<core_behaviors>
<behavior name="assumption_surfacing" priority="high">
Before implementing anything non-trivial, explicitly state your assumptions.

Format:
```
ASSUMPTIONS I'M MAKING:
1. [assumption]
2. [assumption]
→ Correct me now or I'll proceed with these.
```

Never silently fill in ambiguous requirements. The most common failure mode is making wrong assumptions and running with them unchecked. Surface uncertainty early.
</behavior>

<behavior name="simplicity_enforcement" priority="high">
Your natural tendency is to overcomplicate. Actively resist it. If you build 1000 lines and 100 would suffice, you have failed. Prefer the boring, obvious solution. Cleverness is expensive.

Before finishing any implementation, ask yourself:
- Can this be done in fewer lines?
- Are these abstractions earning their complexity?
- Would a senior dev look at this and say "why didn't you just..."?
</behavior>

<behavior name="scope_discipline" priority="medium">
Touch only what you're asked to touch.

Do NOT:
- Remove comments you don't understand
- Refactor adjacent systems as side effects
- Delete code that seems unused without explicit approval
</behavior>
</core_behaviors>

<leverage_patterns>
<pattern name="test_first_leverage">
When implementing non-trivial logic:
1. Write the test that defines success
2. Implement until the test passes
3. Show both

Tests are your loop condition. Use them.
</pattern>

<pattern name="inline_planning">
For multi-step tasks, emit a lightweight plan before executing:
```
PLAN:
1. [step] — [why]
2. [step] — [why]
3. [step] — [why]
→ Executing unless you redirect.
```

This catches wrong directions before you've built on them.
</pattern>
</leverage_patterns>

<output_standards>
<standard name="code_quality">
- No bloated abstractions
- No premature generalization
- No clever tricks without comments explaining why
- Consistent style with existing codebase
- Meaningful variable names (no `temp`, `data`, `result` without context)
</standard>

<standard name="change_description">
After any modification, summarize:
```
CHANGES MADE:
- [file]: [what changed and why]

THINGS I DIDN'T TOUCH:
- [file]: [intentionally left alone because...]

POTENTIAL CONCERNS:
- [any risks or things to verify]
```
</standard>
</output_standards>
</system_prompt>

## Project Overview

Dokumen AI is a monorepo for a PDF entity labeling and NER (Named Entity Recognition) application. The architecture consists of:

- **web**: React frontend using Tanstack Start
- **api**: FastAPI REST API backend
- **workers**: Celery background workers (using Redis message broker)
- **db**: PostgreSQL database with SQL-based migrations via dbmate

All three applications (web, api, workers) share a single PostgreSQL database but use separate schemas with strict access controls.

The database has NOT been instantiated. Do not create new .sql to insert columns, modify the create_table.sql scripts directly. Do not create any backwards compatability.

## Web

### Architecture

- **Framework**: Tanstack Start (SSR React framework) with Tanstack Router and Tanstack Query
- **Routing**: File-based in `src/routes/`, generates `src/routeTree.gen.ts` (NEVER edit this file)
- **Database Access**: ONLY through server functions in `src/db-fns/` (never direct DB access from components)
- **API Communication**: Tanstack Router API routes in `src/routes/api/` or `src/api-fns` using an import from api-json-call.server.ts or api-stream-proxy.server.ts
- **Auth**: Better Auth
- **Styling**: Tailwind CSS v4, config in `src/styles.css`
- **Components**: shadcn/ui in `components/shadcn-ui`
- **PDF Rendering**: EmbedPDF (@embedpdf/pdfium + @embedpdf/core/react) with custom plugins
  - Plugins follow consistent structure with same subfolders as existing plugins
- **Environment Variables** MUST import from `src/env.server.ts` or `src/env.client.ts` (validated via t3-env), NOT from process.env or cross-env.

## API

### Tech Stack

- Framework: FastAPI [docs](https://fastapi.tiangolo.com/), [repo](https://github.com/fastapi/fastapi) with auto-generated MKDocs and concurrent programming
- Typing: Pydantic [docs](https://docs.pydantic.dev/), [repo](https://github.com/pydantic/pydantic)
- Environment variables: imported from .env in ./core/config.py, validated and accessed using [pydantic_settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
- Package manager: uvicorn [uv](https://docs.astral.sh/uv/) to install dependencies in pyproject.toml

### Architecture

- **app/main.py**: Builds FastAPI app, includes router from api.py, defines lifespan
- **app/api.py**: Aggregates all domain routers under `/api/v1` prefix
- **app/core/**: Global functionality (config, db connection, logging, lifespan)
  - **config.py**: Environment variables from .env validated via pydantic_settings
  - **db.py**: asyncpg pool dependency injection (`get_pool`, `get_conn`)
  - **lifespan.py**: Initializes app.state variables
- **app/domains/**: Business domains structure exists but implementations are pending
  - Currently contains empty extract_text and llm_ner directories
  - When implementing: follow the router → service → repository pattern
  - Each domain may contain:
    - router.py (wiring layer) - defines what endpoints are exposed and provides the wiring layer, creates connection using core.db.get_conn()
    - schema.py (typing) - defines pydantic validation schemas for endpoint inputs (never responses, never set response_model) and dataclasses for function outputs when needed for consistency across multiple functions
    - service.py (business logic) - creates functions to perform the main business logic/purpose of the endpoint ()
    - repository.py (db queries) - executes SQL queries to handle necessary database interaction using the connection passed from service.py and router.py
    - tasks.py (side processes) - creates FastAPI background tasks that router.py should call when code can be executed indepndently of/after the response
    - events.py (messaging to workers) - sends tasks to Redis broker using Celery client from core.messaging.celery, messsaging is sync but fast
- **app/utils/**: Generic reusable utilities

### Critical Constraints

- Database interactions ONLY in repository.py files using asyncpg connection passed from router → service → repository
- NO ORM, NO Pydantic/Python schemas for SQL database
- Never set `response_model` in endpoints
- Avoid blocking code in async functions
- Use anyio over asyncio when possible
- Use httpx for all HTTP requests
- never create a class in service.py, repository.py, tasks.py, events.py - create functions
- never create a dataclass in a file that is not named schemas.py
- import settings, never get_settings() from core.settings.py
- do not create global variables, add them to app.state and initialize in lifespan.py

## Workers

### Architecture — Domain-Driven Design

Workers follow a layered DDD architecture. Each domain is self-contained:

workers/app/
├── __main__.py          # Celery app, queues, routing
├── core/                # Config, logging — NO domain imports
├── shared/              # Shared kernel: stable cross-domain concepts
│   ├── domain/          # Value objects (Money, DocumentId), events, exceptions
│   ├── application/     # Cross-domain commands, handlers, queries
│   └── infrastructure/  # DB pool, Redis client, time utilities
├── domains/domain_name1/
│   ├── domain/          # Pure business logic — entities, value objects, services, policies, events, repository interfaces
│   ├── application/     # Use-case orchestration — commands, handlers, workflows
│   ├── infrastructure/  # Adapters — DB repositories, SDK clients, event publishers
│   └── tasks.py         # Celery entrypoints (thin wrappers over handlers)
└── integrations/        # Cross-domain third-party clients (OpenAI, etc.)

### Layer Rules

- **domain/**: Pure business logic. No Celery, no DB, no HTTP, no SDKs. "Is this rule still true if the internet is down?"
- **application/**: Use-case orchestration. Calls domain methods, coordinates repositories. No framework decorators. Handlers must be callable from Celery, FastAPI, CLI, and tests.
- **infrastructure/**: Adapters to the real world. Implements interfaces defined in domain/. "Could I delete this and swap vendors?"
- **tasks.py**: Thin Celery wrappers only — delegate immediately to application handlers.

### shared/ (Shared Kernel)

NOT a utils folder. Only put things here if multiple domains depend on it AND it represents a stable business concept (DocumentId, DomainEvent, base repository interfaces, retry/idempotency abstractions). If it changes frequently, it doesn't belong here.

### Critical Constraints

- No fat Celery tasks — all logic lives in application/ handlers
- Domain layer has zero infrastructure imports
- Repository interfaces in domain/, implementations in infrastructure/
- Use `app.state` patterns, no global variables
- Celery broker: Redis
