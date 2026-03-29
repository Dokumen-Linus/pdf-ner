# Celery Worker App

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

On prod Linux (in Dockerfile):

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

4 Run the workers

TODO

## Tech Stack

- Framework: [Celery](https://docs.celeryq.dev/en/stable/index.html)
- Message Broker: [Redis](https://redis.io/)

## Database

### How Database is Exposed to Workers

1. The database schemas are defined in ./db/migrations/ SQL scripts

**Restriction on Workers Interactions with Database**:

### Start Instructions

Must start the database server before running the FastAPI app. Should run the app and db start commands in separate terminals so that terminating one does not terminate the other.

```cmd
pg_ctl -D .\pgdata -l logfile start
```

### Schemas

#### Auth Schema

Workers do not touch authentication.

#### Web Schema

Contains all tables for the web app defined in ./db/migrations/web. Role workers_user has read-only access.

#### Api Schema

Contains all tables for the backend API defined in ./db/migrations/api. Role workers_user has read-only access.

#### Workers Schema

Contains all tables for the backend workers defined in ./db/migrations/workers. Role owner_role owns the schema so it can be used in migrations. Role workers_user can edit tables (not create or delete tables).
