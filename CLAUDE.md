# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent Skills

@web/node_modules/@tanstack/intent/meta/domain-discovery/SKILL.md
@web/node_modules/@tanstack/intent/meta/feedback-collection/SKILL.md
@web/node_modules/@tanstack/intent/meta/generate-skill/SKILL.md
@web/node_modules/@tanstack/intent/meta/skill-staleness-check/SKILL.md
@web/node_modules/@tanstack/intent/meta/tree-generator/SKILL.md
@web/node_modules/@tanstack/start-client-core/skills/start-core/SKILL.md
@web/node_modules/@tanstack/start-client-core/skills/start-core/deployment/SKILL.md
@web/node_modules/@tanstack/start-client-core/skills/start-core/execution-model/SKILL.md
@web/node_modules/@tanstack/start-client-core/skills/start-core/middleware/SKILL.md
@web/node_modules/@tanstack/start-client-core/skills/start-core/server-functions/SKILL.md
@web/node_modules/@tanstack/start-client-core/skills/start-core/server-routes/SKILL.md
@web/node_modules/@tanstack/start-server-core/skills/start-server-core/SKILL.md
@web/node_modules/@tanstack/router-plugin/skills/router-plugin/SKILL.md
@web/node_modules/@tanstack/virtual-file-routes/skills/virtual-file-routes/SKILL.md
@web/node_modules/@tanstack/cli/skills/add-addons-existing-app/SKILL.md
@web/node_modules/@tanstack/cli/skills/choose-ecosystem-integrations/SKILL.md
@web/node_modules/@tanstack/cli/skills/create-app-scaffold/SKILL.md
@web/node_modules/@tanstack/cli/skills/maintain-custom-addons-dev-watch/SKILL.md
@web/node_modules/@tanstack/cli/skills/query-docs-library-metadata/SKILL.md
@web/node_modules/@rolder-kit/tanstack/skills/cookies/SKILL.md

## Project Overview

Dokumen AI is a monorepo for a PDF entity labeling and NER (Named Entity Recognition) application. The architecture consists of:

- **web**: React frontend using Tanstack Start
- **api**: FastAPI REST API backend
- **workers**: Celery background workers (using Redis message broker)
- **db**: PostgreSQL database with SQL-based migrations via dbmate

All three applications (web, api, workers) share a single PostgreSQL database but use separate schemas with strict access controls.

## Database Setup & Management

### Starting the Database

The PostgreSQL database must be running before starting any application:

```cmd
pg_ctl -D .\pgdata -l logfile start
```

### Database Initialization

First-time setup:

```cmd
initdb -D .\pgdata
pg_ctl -D .\pgdata -l logfile start
createdb dokumen
set DATABASE_URL=postgres://localhost/dokumen?sslmode=disable
dbmate up
psql -f .\db\migrations\better-auth\2025-12-22T03-27-15.344Z.sql -d dokumen
```

### Schema Architecture

The database has multiple schemas with role-based access control:

- **auth schema**: Better Auth tables, managed by `auth_user` role (web only)
- **web schema**: Frontend tables, owned by `web_owner`, editable by `web_user`
- **api schema**: Backend tables, owned by `api_owner`, editable by `api_user`, read-only for `web_user`
- **workers schema**: Worker tables, owned by `worker_owner`, read-only for `web_user`
- **public schema**: Only for migration scripts

### Migration Scripts

Located in `db/migrations/` with subdirectories for each schema. Currently using numerical prefixes (will switch to datetime on first release). Scripts run in alphanumeric order via dbmate.

## API (FastAPI Backend)

### Setup & Development

```cmd
cd api
uv venv .venv
powershell .\.venv\Scripts\activate   # Windows
# OR
source .venv/bin/activate              # Mac/Linux
uv pip install .
uv pip install -e ".[dev]"
```

### Running the API

```cmd
cd api
powershell .\.venv\Scripts\activate   # activate environment
uvicorn app.main:app --reload
```

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
    - **router.py**: Endpoint definitions (wiring layer)
    - **schema.py**: Pydantic validation schemas for inputs (NOT responses)
    - **service.py**: Business logic
    - **repository.py**: SQL queries using asyncpg connection
    - **tasks.py**: FastAPI background tasks
- **app/utils/**: Generic reusable utilities

### Critical Constraints

- Database interactions ONLY in repository.py files using asyncpg
- NO ORM, NO Pydantic/Python schemas for SQL database
- Never set `response_model` in endpoints
- Connection passed from router → service → repository
- Avoid blocking code in async functions
- Use anyio over asyncio when possible
- Use httpx for all HTTP requests
- Never use uvloop on Windows (installed via `fastapi[standard]` for prod)

### Linting & Formatting

```cmd
cd api
ruff check .
ruff format .
deptry .  # check dependencies
```

Configuration in `api/pyproject.toml` and root `ruff.toml`.

## Web (React Frontend)

### Setup & Development

```cmd
cd web
bun i
bunx playwright install  # for e2e tests
bun dev                  # starts on port 3000
```

### Key Commands

| Command | Description |
|---------|-------------|
| `bun dev` | Run dev server on port 3000 |
| `bun build` | Build for production |
| `bun tsc` | Type check without emitting files |
| `bun lint` | Check linting |
| `bun lint:fix` | Auto-fix linting errors |
| `bun prettier:fix` | Format code |
| `bun test` | Run Bun tests with React Testing Library |
| `bun test:db` | Run database function tests (requires db running) |
| `bun test:e2e` | Run Playwright e2e tests |
| `bun depcheck` | Check for unused dependencies |
| `bun storybook` | Start Storybook on port 6006 |

### Architecture

- **Framework**: Tanstack Start (SSR React framework) with Tanstack Router and Tanstack Query
- **Routing**: File-based in `src/routes/`, generates `src/routeTree.gen.ts` (NEVER edit this file)
- **Database Access**: ONLY through server functions in `src/db-fns/` (never direct DB access from components)
  - Uses Drizzle ORM + Zod validation
  - Schemas defined in THREE places: SQL migrations, `src/db/schema/` (Drizzle TS), `src/db-fns/` (Zod)
  - Test `match-schemas.test.ts` ensures Drizzle schemas match Zod schemas
  - **Four-step database interaction process:**
    1. SQL scripts in `db/migrations/` define tables (source of truth) - includes users, projects, entity_types, pdfs, annotations in web schema
    2. TypeScript schemas in `web/src/db/schema/` mirror SQL structure using Drizzle ORM
    3. Server functions in `web/src/db-fns/` provide validated database operations using Zod
    4. Pages in `web/src/routes/` consume the server functions for all database interactions
- **API Communication**: Tanstack Router API routes in `src/routes/api/` using Axios
- **State Management**: React useState (local), Zustand (global)
- **Forms**: Tanstack Form + shadcn/ui components + Zod validation
- **Auth**: Better Auth with Tanstack integration
- **Styling**: Tailwind CSS v4, config in `src/styles.css`
- **Components**: shadcn/ui in `components/shadcn-ui`
- **PDF Rendering**: EmbedPDF (@embedpdf/pdfium + @embedpdf/core/react) with custom plugins
  - Plugins follow consistent structure with same subfolders as existing plugins

### Key Framework Files

- `src/__root.tsx`: Root layout for entire site
- `src/router.tsx`: Exposes routes
- `src/client.tsx`: Client entrypoint
- `src/server.tsx`: Server entrypoint
- `src/env.client.ts`, `src/env.server.ts`: Environment variable validation (import env from here, not process.env)
- `src/routes/_public.tsx`: Public site layout
- `src/routes/_auth.tsx`: Auth pages layout

### Environment Variables

MUST import from `src/env.server.ts` or `src/env.client.ts` (validated via t3-env), NOT from process.env or cross-env.

### Linting & Formatting

- ESLint 9 (config: `eslint.config.mjs`)
- Prettier (auto-formats on save in VSCode)
- Commitlint enforces Conventional Commits via husky

### Commit Message Format

Must use conventional commit prefixes:

- `feat:` - new feature (minor version bump)
- `fix:` - bug fix (patch)
- `perf:` - performance improvement (patch)
- `docs:`, `test:`, `ci:`, `refactor:`, `style:`, `chore:`, `build:` - no version bump
- `type!:` - breaking change (major version bump)

## Workers (Celery) - IN DEVELOPMENT

**Current Status**: The workers directory structure exists but is not fully implemented.

### Setup Required

The workers currently have:
- Empty pyproject.toml (needs dependencies)
- Incomplete Celery configuration (missing CELERY_BROKER_URL property)
- No actual task implementations
- Empty Redis/Docker configuration files

### Tech Stack (When Implemented)

- Celery framework with Redis message broker
- Python 3.13 (matches API)

### Directory Structure

- `workers/app/main.py`: Celery app definition
- `workers/app/core/`: Core configuration
- `workers/app/tasks/`: Task definitions (currently empty)

### When Implementing Workers:

- Add Celery and Redis dependencies to pyproject.toml
- Complete the settings configuration in workers/app/core/config.py
- Set up Redis infrastructure (infra/redis.conf is currently empty)
- Implement actual tasks in workers/app/tasks/

## Infrastructure - IN DEVELOPMENT

The infra/ directory exists but configuration files are currently empty:
- docker-compose.yml (0 bytes)
- redis.conf (0 bytes)

These need to be implemented when setting up production deployment.

## Development Workflow

### Terminal Setup

Use separate terminals for each service to prevent accidental termination:

1. Terminal 1: Database (`pg_ctl -D .\pgdata -l logfile start`)
2. Terminal 2: API (`cd api && uvicorn app.main:app --reload`)
3. Terminal 3: Web (`cd web && bun dev`)
4. Terminal 4: Workers (when needed)

### Common Issues

- **Database not running**: Start with `pg_ctl -D .\pgdata -l logfile start`
- **Python env not activated**: Run `powershell .\.venv\Scripts\activate` (Windows) or `source .venv/bin/activate` (Mac)
- **Node modules out of sync**: Run `bun i` in web directory
- **Type errors in web**: Never edit `src/routeTree.gen.ts`, close it while dev server is running

### Testing

- API: Tests in `api/tests/` (setup TBD, use pytest with pytest.mark.anyio)
- Web: Tests in `web/tests/` and `web/src/**/*.{spec,test}.{ts,tsx}`
  - Unit tests: Bun Test Runner + React Testing Library
  - E2E tests: Playwright in `tests/e2e/*.e2e.ts`
  - Storybook: Component stories in `src/components/shadcn-stories/`

### PDF Processing

The application uses EmbedPDF packages for PDF rendering and interaction:
- Core: @embedpdf/core, @embedpdf/engines, @embedpdf/pdfium
- Plugins: viewport, zoom, render, thumbnail, interaction-manager, etc.
- Custom implementations located in `web/src/components/pdf-container/`
- Plugins follow consistent structure with same subfolders as existing plugins

### Package Patches

- Uses patch-package for NPM package modifications
- Postinstall script: "npx patch-package -y"
- Patches applied automatically after npm install

### Environment Variables

The project includes example environment files:
- Web: .env.local.example (includes AUTH_DATABASE_URL and APP_DATABASE_URL for multi-role setup)
- API: .env.local.example
- Workers: .env.local.example (REDIS_URL configuration)

## Code Style & Best Practices

### Python (API/Workers)

- Format with Ruff (line length: 100)
- Use asyncpg for database queries
- Never create global variables, use `app.state` initialized in lifespan
- Pass database connection as dependency through layers
- Repository pattern: router → service → repository
- Double quotes, space indentation

### TypeScript/React (Web)

- Format with Prettier + ESLint
- Import env from `src/env.*.ts` files only
- Database access ONLY through db-fns server functions
- Forms: Tanstack Form + shadcn/ui + Zod
- Icons: Lucide React
- Testing: React Testing Library + Bun Test Runner

### SQL

- Migrations in `db/migrations/{schema}/` subdirectories
- Follow `db/migrations/rules.md`

## VSCode Configuration

The project is configured with format-on-save for all file types:

- Python: Ruff formatter
- TypeScript/JavaScript/React: Prettier + ESLint
- Auto-save on focus change enabled
- Protected branch: master
