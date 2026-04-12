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

3 Ensure .env is created following to .env.local.example

### Running the workers

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

3 Start Redis server

Windows (with chocolatey):
```cmd
redis-server
```

Mac (with homebrew):
```cmd
redis-server
```

4 Run the workers with 4 processes

```cmd
celery -A app.main worker --loglevel=info --concurrency=4
```

## Database

**Restriction on Workers Interactions with Database**: The workers can only execute SQL scripts in functions in repository.py files using the [asyncpg](https://github.com/MagicStack/asyncpg) connection created in workers\app\shared\infrastructure\db.py. No ORM, Pydantic, or other Python schemas for the SQL database are allowed. Validation of the query is solely whether SQL can execute it. Connection is passed from router.py to service.py functions to repository.py functions.

**Schemas**: worker_user has CRUD permissions on workers schema and read permissions on web, api, and public schemas

## Tech Stack

- Framework: [Celery](https://docs.celeryq.dev/en/stable/index.html)
- Message Broker: [Redis](https://redis.io/)

## Workers Layout

workers/
└── app/
    ├── __init__.py
    ├── __main__.py # celery app, queues, routing
    │
    ├── core/ 
    │   ├── __init__.py
    │   ├── config.py
    │   └── logging.py
    │
    ├── shared/                  # Shared kernel (domain-driven design term)
    │   ├── __init__.py
    │   ├── domain/
    │   │   ├── entities.py
    │   │   ├── value_objects.py
    │   │   ├── events.py
    │   │   └── exceptions.py
    │   │
    │   ├── application/
    │   │   ├── commands.py
    │   │   └── handlers.py
    │   │   ├── queries.py # read-only use-cases
    │   │
    │   └── infrastructure/
    │       ├── db.py
    │       ├── redis.py
    │       └── time.py
    │
    ├── domains/
    │   ├── domain1/
    │   │   ├── __init__.py
    │   │
    │   │   ├── domain/
    │   │   │   ├── entities.py
    │   │   │   ├── value_objects.py
    │   │   │   ├── services.py
    │   │   │   ├── events.py
    │   │   │   └── policies.py
    │   │   │   └── repositories.py
    │   │   │
    │   │   ├── application/
    │   │   │   ├── commands.py
    │   │   │   ├── handlers.py
    │   │   │   └── workflows.py
    │   │   │
    │   │   ├── infrastructure/
    │   │   │   ├── repositories.py
    │   │   │   ├── event_publisher.py
    │   │   │
    │   │   └── tasks.py        # Celery tasks (thin)
    │   │
    │   ├── domain2/
    │   │   └── ...
    │
    ├── integrations/
    │   ├── __init__.py
    │   ├── openai/

- **core/**: Process wiring, config, logging. No domain imports.
- **shared/**: Shared kernel — stable cross-domain concepts only (DocumentId, DomainEvent, base repository interfaces, retry abstractions). Not a utils folder. If it changes frequently, it doesn’t belong here.
- **integrations/**: Cross-domain third-party clients (OpenAI, etc.). Expose capability-focused APIs, not raw SDK calls.
- **domains/\<name\>/**: Each domain is self-contained with three layers:
  - **domain/**: Pure business logic. No Celery, no DB, no HTTP, no SDKs.
    - `entities.py` — Long-lived objects with identity that enforce invariants
    - `value_objects.py` — Immutable, identity-less concepts with construction-time validation
    - `services.py` — Multi-entity business logic with zero I/O
    - `policies.py` — Declarative decision rules (“when is X allowed?”)
    - `events.py` — Immutable records of something that already happened
    - `repositories.py` — Persistence contracts (Protocol interfaces only, no SQL)
  - **application/**: Use-case orchestration. Coordinates domain methods and repositories. No framework decorators.
    - `commands.py` — Frozen dataclasses expressing user/system intent
    - `handlers.py` — Single use-case executors, callable from Celery/FastAPI/CLI/tests
    - `workflows.py` — Multi-step processes, saga orchestration, compensation steps
    - `queries.py` — Read-only use cases (CQRS). No domain mutations.
  - **infrastructure/**: Replaceable adapters to the real world.
    - `repositories.py` — asyncpg/SQL implementations of domain repository interfaces
    - `event_publisher.py` — Publishes domain events to Redis
  - `tasks.py` — Thin Celery entrypoints that delegate immediately to application handlers

Self-check: Domain — “Is this rule still true if the internet is down?” Application — “Is this how we do it, not what is true?” Infrastructure — “Could I delete this and swap vendors?”