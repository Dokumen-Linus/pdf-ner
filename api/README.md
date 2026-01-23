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

On Mac:

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

### Running the backend app

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

- [asyncio docs](https://docs.python.org/3/library/asyncio.html), [repo](https://github.com/python/cpython/tree/3.14/Lib/asyncio)
- [anyio docs](https://anyio.readthedocs.io/), [repo](https://github.com/anyio/anyio)
- [httpx](https://www.python-httpx.org/), [repo](https://github.com/encode/httpx)
- AsyncIterator from collections.abc
- asynccontextmanager from contextlib

### Root files

- main.py: builds the Fast API app from the router in api.py, should rarely be updated
- api.py: imports all endpoints from the various domains/**/router.py, should be updated when creating a new domain

### Directories

- core: global functionalities like config, logging, db connection, connection to external APIs
- domains: contains different domains, which are groups of endpoints to acheive a business purpose
- tests: test files
- utils: generic code not specific to a business purpose that could be re-used in a hypothetical new domain

### Domains

Each domain may have the following files:

- router.py (wiring layer) - defines what endpoints are exposed and provides the wiring layer
- schema.py (typing) - defines pydantic validation schemas for endpoint inputs (never responses, never set response_model)
- service.py (business logic) - creates functions to perform the main business logic/purpose of the endpoint ()
- repository.py (db queries) - executes SQL queries to handle necessary database interaction using the connection passed from service.py and router.py
- tasks.py (side processes) - creates FastAPI background tasks that router.py should call when code can be executed indepndently of/after the response

### FastAPI Best Practices

- avoid blocking code and do not put it inside async fncts\
- do not create global variables, add them to app.state and initialize in lifespan.py
- use anyio instead of asyncio whenever possible [anyio docs](https://anyio.readthedocs.io/), [repo](https://github.com/anyio/anyio)
- perform all http requests with [httpx](https://www.python-httpx.org/), [repo](https://github.com/encode/httpx)
- requirements.txt installs `fastapi[standard]` to ensure uvloop and httptools are used in prod (uvloop is not installable on Windows)

## Tests

- to be setup

### Best Practices

- Use pytest.mark.anyio for testing, examples [Kludex/fastapi-tips](https://github.com/Kludex/fastapi-tips)
- Use Async Client instead of starlette.testclient whenver possible: from httpx import Async Client, repo [encode/httpx](https://github.com/encode/httpx), [docs](https://www.python-httpx.org/), examples [Kludex/fastapi-tips](https://github.com/Kludex/fastapi-tips)

## Database

### How Database is Exposed to API

1. The database schemas are defined in ./db/migrations/ SQL scripts
1. ./backend/core/db.py defines the PostgreSQL pool that can execute read-write queries to api schema and read queries to app schema
1. ./backend/domains/**/router.py files import ./backend/core/db in order to start a single connection per endpoint call
1. connection is passed from router.py to service.py functions to repository.py functions
1. only functions in repository.py may execute SQL scripts

**Restriction on API Interactions with Database**: The backend can only interact with database in repository.py files using the [asyncpg](https://github.com/MagicStack/asyncpg) connection created in router.py. No ORM, Pydantic, or other Python schemas for the SQL database are allowed. Validation of the query is solely whether SQL can execute it.

### Start Instructions

Must start the database server before running the FastAPI app. Should run the app and db start commands in separate terminals so that terminating one does not terminate the other.

### Schemas

#### Public Schema

Only used for migration scripts.

#### Auth Schema

Contains all tables for authentication (not authorization). Role api_user has no access.

#### App Schema

Contains all tables for the frontend defined in ./db/migrations/. Role api_user has read-only access.

#### Api Schema

Contains all tables for the backend defined in ./db/migrations/. Role api_owner owns the schema so it can be used in migrations. Role api_user can only edit tables so that asyncpg can't create or delete tables etc.
