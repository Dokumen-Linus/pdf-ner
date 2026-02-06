# Dokumen AI API

## Quickstart

1 Install [Python 3.13](https://www.python.org/downloads/release/python-31311/) without Conda/MiniConda/AnaConda distributions and set PATH environment variable (Windows)

2 Create Python environment and install libraries

On Windows (dev):

```cmd
uv venv .venv
powershell .\.venv\Scripts\activate
uv pip install .
uv pip install -e ".[dev]"
```

On Mac (dev):

```cmd
uv venv .venv
source .venv/bin/activate
uv pip install .
uv pip install -e ".[dev]"
```

Later, activate your existing environment with just the second command.

Pre-prod:

```cmd
uv pip compile pyproject.toml -o uv.lock
```

On prod Linux (add to Dockerfile):

```cmd
uv venv .venv
source .venv/bin/activate
uv pip sync uv.lock
```

Using v3.13 until most libraries have upgraded to 3.14 (currently I have "python" PATH set to 3.13.11 and "py" set to 3.14.2)

### Running the api

1 Start the database server

```cmd
pg_ctl -D .\pgdata -l logfile start
```

2 Activate the Python environment

Windows:

```cmd
powershell .\.venv\Scripts\activate
```

Mac:

```cmd
source .venv/bin/activate
```

3 Ensure .env is created following to .env.local.example

4 Run the app as a module (not a script)

```cmd
uvicorn app.main:app --reload
```

### Fast API Endpoint VSCode Extension

Visualizes the endpoints exposed by the api and what file defines them

## Tech Stack

- Framework: FastAPI [docs](https://fastapi.tiangolo.com/), [repo](https://github.com/fastapi/fastapi) with auto-generated MKDocs and concurrent programming
- Typing: Pydantic [docs](https://docs.pydantic.dev/), [repo](https://github.com/pydantic/pydantic)
- Environment variables: imported from .env in ./core/config.py, validated and accessed using [pydantic_settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
- Package manager: uvicorn [uv](https://docs.astral.sh/uv/) to install dependencies in pyproject.toml
- Dependency checker: [deptry](https://github.com/fpgmaas/deptry)

### Concurrent Programming Packages

- **AnyIO** [docs](https://anyio.readthedocs.io/), [repo](https://github.com/anyio/anyio)
- **AsyncIO** [docs](https://docs.python.org/3/library/asyncio.html), [repo](https://github.com/python/cpython/tree/3.14/Lib/asyncio)
- [httpx](https://www.python-httpx.org/), [repo](https://github.com/encode/httpx)
- AsyncIterator from collections.abc
- asynccontextmanager from contextlib

### Root files

- main.py: builds the Fast API app from the router in api.py, should rarely be updated
- api.py: imports all endpoints from the various domains/**/router.py, should be updated when creating a new domain

### Directories

- core: global functionalities like config, logging, db connection, connection to external APIs
- domains: contains different domains, which are groups of endpoints to acheive a business purpose
- utils: generic code not specific to a business purpose that could be re-used in a hypothetical new domain

### Domains

Each domain may have the following files:

- router.py (wiring layer) - defines what endpoints are exposed and provides the wiring layer, creates connection using core.db.get_conn()
- schema.py (typing) - defines pydantic validation schemas for endpoint inputs (never responses, never set response_model)
- service.py (business logic) - creates functions to perform the main business logic/purpose of the endpoint ()
- repository.py (db queries) - executes SQL queries to handle necessary database interaction using the connection passed from service.py and router.py
- tasks.py (side processes) - creates FastAPI background tasks that router.py should call when code can be executed indepndently of/after the response
- events.py (messaging to workers) - sends tasks to Redis broker using Celery client from core.messaging.celery, messsaging is sync but fast

### Required Best Practices

- avoid blocking code and do not put it inside async fncts
- use anyio instead of asyncio whenever possible. attempt to replace every use of asyncio with anyio
- perform all http requests with [httpx](https://www.python-httpx.org/), [repo](https://github.com/encode/httpx)
- never pass app.state to service.py, define specific dependencies in a function in core.dependencites.py
- never create a class in service.py, repository.py, tasks.py, events.py - create functions
- import settings, never get_settings() from core.settings.py
- do not create global variables, add them to app.state and initialize in lifespan.py
- only functions in a repository.py may execute SQL scripts
- schemas should never be defined in Python for the db, the only validation is whether SQL statements by asyncpg execute
- pyproject.toml installs `fastapi[standard]` to ensure uvloop and httptools are used in prod (uvloop is not installable on Windows)

## Tests

### Setup

Test dependencies are installed with the dev extras:

```cmd
uv pip install -e ".[dev]"
```

This installs pytest, pytest-anyio, and httpx for testing.

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

### Running Tests

From the `api/` directory with the virtual environment activated:

```cmd
pytest
```

Run with verbose output:

```cmd
pytest -v
```

Run a specific test file:

```cmd
pytest tests/domains/test_llm_ner.py
```

Run a specific test class or function:

```cmd
pytest tests/domains/test_llm_ner.py::TestBuildPrompt
pytest tests/domains/test_llm_ner.py::TestBuildPrompt::test_interpolates_all_placeholders
```

### Fixtures

Shared fixtures are defined in `tests/conftest.py`. These include:

- `mock_anthropic_client` - mocked Anthropic client
- `mock_openai_client` - mocked OpenAI client
- `mock_google_client` - mocked Google AI client
- `mock_clients` - dict containing all three mocked clients
- `sample_entity_types` - sample entity type records
- `sample_template` - sample template record

### Best Practices

- Use `@pytest.mark.anyio` for async tests (not asyncio.run or pytest-asyncio)
- Use `AsyncMock` and `MagicMock` from unittest.mock for mocking
- Use httpx AsyncClient instead of starlette.testclient for integration tests
- Mock database connections with `AsyncMock()` and set `fetchrow`, `fetch`, `fetchval` as needed
- Test service functions directly rather than going through the router when testing business logic

## Database

### How Database is Exposed to API

1. The database schemas are defined in ./db/migrations/ SQL scripts
1. ./backend/core/db.py defines the PostgreSQL pool that can execute read-write queries to api schema and read queries to app schema
1. ./backend/domains/**/router.py files import ./backend/core/db in order to start a single connection per endpoint call

**Restriction on API Interactions with Database**: The backend only can execute SQL scripts in functions in repository.py files using the [asyncpg](https://github.com/MagicStack/asyncpg) connection created in router.py. No ORM, Pydantic, or other Python schemas for the SQL database are allowed. Validation of the query is solely whether SQL can execute it. Connection is passed from router.py to service.py functions to repository.py functions.

### Start Instructions

Must start the database server before running the FastAPI app. Should run the app and db start commands in separate terminals so that terminating one does not terminate the other.

```cmd
pg_ctl -D .\pgdata -l logfile start
```

### Schemas

#### Auth Schema

API does not touch authentication.

#### Web Schema

Contains all tables for the web app defined in ./db/migrations/web. Role api_user has read-only access.

#### Api Schema

Contains all tables for the backend API defined in ./db/migrations/api. Role owner_role owns the schema so it can be used in migrations. Role api_user can edit tables (not create or delete tables).


#### Workers Schema

Contains all tables for the backend workers defined in ./db/migrations/workers. Role api_user has read-only access.
