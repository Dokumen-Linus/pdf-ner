# Dokumen AI API

## Quickstart

1 Install [Python 3.13](https://www.python.org/downloads/release/python-31311/) without Conda/MiniConda/AnaConda distributions and set PATH environment variable (Windows)

2 Create Python environment and install libraries

On Windows (dev):

```bash
uv venv .venv
powershell .\.venv\Scripts\activate
uv pip install .
uv pip install -e ".[dev]"
```

On Mac (dev):

```bash
uv venv .venv
source .venv/bin/activate
uv pip install .
uv pip install -e ".[dev]"
```

Later, activate your existing environment with just the second command.

Pre-prod:

```bash
uv pip compile pyproject.toml -o uv.lock
```

On prod Linux (add to Dockerfile):

```bash
uv venv .venv
source .venv/bin/activate
uv pip sync uv.lock
```

Using v3.13 until most libraries have upgraded to 3.14 (currently I have "python" PATH set to 3.13.11 and "py" set to 3.14.2)

3 Ensure .env is created following to .env.local.example

### Running the api

1 Start the database server

```bash
pg_ctl -D .\pgdata -l logfile start
```

2 Activate the Python environment

Windows:

```bash
powershell .\.venv\Scripts\activate
```

Mac:

```bash
source .venv/bin/activate
```

3 Run the app as a module (not a script)

```bash
uvicorn app.main:app --reload
```

### Fast API Endpoint VSCode Extension

Visualizes the endpoints exposed by the api and what file defines them

## Database

### How Database is Exposed to API

1. The database schemas are defined in ./db/migrations/ SQL scripts
1. ./backend/core/db.py defines the PostgreSQL pool that can execute read-write queries to api schema and read queries to app schema
1. ./backend/domains/**/router.py files import ./backend/core/db in order to start a single connection per endpoint call

**Restriction on API Interactions with Database**: The API can only execute SQL scripts in functions in repository.py files using the [asyncpg](https://github.com/MagicStack/asyncpg) connection created in router.py. No ORM, Pydantic, or other Python schemas for the SQL database are allowed. Validation of the query is solely whether SQL can execute it. Connection is passed from router.py to service.py functions to repository.py functions.

**Schemas**: api_user has CRUD permissions on api schema and read permissions on web, workers, and public schemas, with INSERT access to workers.llm_usage for project-scoped usage recording.

## Tech Stack

- Framework: FastAPI [docs](https://fastapi.tiangolo.com/), [repo](https://github.com/fastapi/fastapi) with auto-generated MKDocs and concurrent programming
- Typing: Pydantic [docs](https://docs.pydantic.dev/), [repo](https://github.com/pydantic/pydantic)
- Environment variables: imported from .env in ./core/config.py, validated and accessed using [pydantic_settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
- Package manager: uvicorn [uv](https://docs.astral.sh/uv/) to install dependencies in pyproject.toml
- Formatting and linting: [ruff](https://docs.astral.sh/ruff/)
- Dependency checker: [deptry](https://github.com/fpgmaas/deptry)

### Concurrent Programming Packages

- **AnyIO** [docs](https://anyio.readthedocs.io/), [repo](https://github.com/anyio/anyio)
- **AsyncIO** [docs](https://docs.python.org/3/library/asyncio.html), [repo](https://github.com/python/cpython/tree/3.14/Lib/asyncio)
- [httpx](https://www.python-httpx.org/), [repo](https://github.com/encode/httpx)
- AsyncIterator from collections.abc
- asynccontextmanager from contextlib

## API Layout

### Root files

- main.py: builds the Fast API app from the router in api.py, should rarely be updated
- api.py: imports all endpoints from the various domains/**/router.py, should be updated when creating a new domain

### Directories

- core: global functionalities like config, logging, db connection, connection to external APIs
- domains: contains different domains, which are groups of endpoints to achieve a business purpose
- domains\shared: schemas, repositories, tasks or events that apply to multiple domains
- integration:  code not specific to a business purpose that defines use of an external service
- utils: generic code not specific to a business purpose that could be re-used in a hypothetical new domain

### Domains

Each domain may have the following files:

- router.py (wiring layer) - defines what endpoints are exposed and provides the wiring layer, creates connection using core.db.get_conn()
- schema.py (typing) - defines pydantic validation schemas for endpoint inputs (never responses, never set response_model) and dataclasses for function outputs when needed for consistency across multiple functions
- service.py (business logic) - creates functions to perform the main business logic/purpose of the endpoint ()
- repository.py (db queries) - executes SQL queries to handle necessary database interaction using the connection passed from service.py and router.py
- tasks.py (side processes) - creates FastAPI background tasks that router.py should call when code can be executed independently of/after the response
- events.py (messaging to workers) - sends tasks to Redis broker using Celery client from core.messaging.celery, messaging is sync but fast

### Required Best Practices

- avoid blocking code and do not put it inside async functions
- use anyio instead of asyncio whenever possible. attempt to replace every use of asyncio with anyio
- perform all http requests with httpx [docs](https://www.python-httpx.org/), [repo](https://github.com/encode/httpx)
- never pass app.state to service.py, define specific dependencies in a function in core.dependencies.py
- never create a class in service.py, repository.py, tasks.py, events.py - create functions
- never create a dataclass in a file that is not named schemas.py
- import settings, never get_settings() from core.settings.py
- do not create global variables, add them to app.state and initialize in lifespan.py
- only functions in a repository.py may execute SQL scripts
- schemas should never be defined in Python for the db, the only validation is whether SQL statements by asyncpg execute
- pyproject.toml installs `fastapi[standard]` to ensure uvloop and httptools are used in prod (uvloop is not installable on Windows)

## Tests

### Setup

Test dependencies are installed with the dev extras:

```bash
uv pip install -e ".[dev]"
```

This installs pytest, pytest-anyio, and httpx for testing.

### Running Tests

From the `api/` directory with the virtual environment activated:

```bash
pytest
```

Run with verbose output:

```bash
pytest -v
```

Run a specific test file:

```bash
pytest tests/domains/test_llm_ner.py
```

Run a specific test class or function:

```bash
pytest tests/domains/test_llm_ner.py::TestBuildPrompt
pytest tests/domains/test_llm_ner.py::TestBuildPrompt::test_interpolates_all_placeholders
```

### Directory Structure

```text
tests/
├── __init__.py
├── conftest.py          # shared fixtures
├── main.py              # (reserved for future use)
└── domains/
    ├── __init__.py
    └── test_llm_ner.py  # tests for domains/llm_ner
```

Test files mirror the `app/domains/` structure. Each domain's tests go in `tests/domains/test_{domain_name}.py`.

### Naming Convention

Test files must be named `test_*.py` (not `*_test.py`). This is configured in pyproject.toml:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = "test_*.py"
```

### Fixtures

Shared fixtures are defined in `tests/conftest.py`. These include:

- `mock_anthropic_client` - mocked Anthropic client
- `mock_clients` - dict containing all three mocked clients (Anthropic, OpenAI, Gemini)
- `sample_entity_types` - sample entity type records
- `sample_template` - sample template record

### Best Practices

- Use `@pytest.mark.anyio` for async tests (not asyncio.run or pytest-asyncio)
- Use `AsyncMock` and `MagicMock` from unittest.mock for mocking
- Use httpx AsyncClient instead of starlette.testclient for integration tests
- Mock database connections with `AsyncMock()` and set `fetchrow`, `fetch`, `fetchval` as needed
- Test service functions directly rather than going through the router when testing business logic
