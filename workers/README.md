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

**Restriction on Workers Interactions with Database**: The workers can only execute SQL scripts in functions in repository.py files using the [asyncpg](https://github.com/MagicStack/asyncpg) connection created in workers\infrastructure\db.py. No ORM, Pydantic, or other Python schemas for the SQL database are allowed. Validation of the query is solely whether SQL can execute it. Connection is passed from router.py to service.py functions to repository.py functions.

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

### core/

Process wiring and config only

Signal hooks

Logging

No domain imports

### shared/ (Shared Kernel)

This is not utils.

Put things here only if:

Multiple domains depend on it

It represents a stable business concept

Examples:

Money, DocumentId, UserId

DomainEvent

Base repository interfaces

Retry / idempotency abstractions

If something changes frequently → it doesn’t belong here.

### domains/<domain_name>/

Each domain is self-contained.

#### domain/

Pure business logic:

Entities

Value objects

Domain services

Policies (rules like “when X is allowed”)

No Celery, no DB, no HTTP, no SDKs.

#### application/

Use-case orchestration:

Commands / handlers

Workflows (long-running, multi-step logic)

Calls domain methods

This is where workers actually do work, but still framework-free.

#### infrastructure/

Adapters:

DB repositories

External SDKs

OCR / PDF engines

Implements interfaces defined in domain/ or core/.

tasks.py

Celery entrypoints:

@celery.task
def process_document_task(doc_id: str):
    handle_process_document(ProcessDocument(doc_id))

### integrations/

Cross-domain third-party clients:

OpenAI

These should expose capability-focused APIs, not raw SDK calls.

### Layout Best Practices

No Fat Celery tasks → untestable, duplicated logic

no utils folder for shared code without clear structure → future refactor hell

### domain/ — Business rules and invariants

Golden rule: nothing here knows how the world works (DBs, queues, SDKs). It only knows what must be true.

#### domain/entities.py

Purpose

Long-lived objects with identity

Enforce invariants over time

Contains

Core domain objects (Document, Page, ExtractionJob)

Methods that change state and enforce rules

class Document:
    def mark_processed(self) -> None:
        if self.status != Status.PROCESSING:
            raise InvalidState(...)
        self.status = Status.PROCESSED

Does NOT contain

Persistence logic

API models

DTOs

If it has an id and business rules → entity.

#### domain/value_objects.py

Purpose

Immutable, identity-less domain concepts

Express meaning and validation

Contains

DocumentId, PageCount, ConfidenceScore

Validation at construction time

@dataclass(frozen=True)
class ConfidenceScore:
    value: float

    def __post_init__(self):
        if not 0 <= self.value <= 1:
            raise ValueError


Does NOT contain

Database serialization

Business workflows

If two values with the same data are interchangeable → value object.

#### domain/services.py

Purpose

Business logic that doesn’t belong on a single entity

Contains

Multi-entity rules

Pure domain logic

def should_retry_ocr(document: Document, attempts: int) -> bool:
    return attempts < document.max_retries

Does NOT contain

Infrastructure calls

I/O of any kind

If you feel tempted to inject a client here — stop.

#### domain/policies.py

Purpose

Conditional rules / permissions / thresholds

“When is X allowed?”

Contains

Feature gating rules

Risk rules

Escalation thresholds

class LargeDocumentPolicy:
    def requires_manual_review(self, page_count: int) -> bool:
        return page_count > 500

Why separate from services?
Policies are decision rules, not workflows. This keeps them testable and declarative.

#### domain/events.py

Purpose

Capture something meaningful that already happened

Contains

Immutable event objects

@dataclass(frozen=True)
class DocumentProcessed:
    document_id: DocumentId
    page_count: int

Does NOT contain

Side effects

Event handlers

Events describe facts, not actions.

domain/repositories.py (optional but common)

Purpose

Persistence contracts

Contains

Interfaces / protocols only

class DocumentRepository(Protocol):
    def get(self, id: DocumentId) -> Document: ...
    def save(self, document: Document) -> None: ...

Does NOT contain

SQL

ORM code

If you can swap Postgres for Dynamo without touching the domain, you did it right.

### application/ — Use cases and orchestration

Golden rule: this layer coordinates work but owns no business rules.

#### application/commands.py

Purpose

Express user/system intent

Contains

Simple intent objects

@dataclass(frozen=True)
class ProcessDocument:
    document_id: DocumentId

Why separate?
Commands are stable inputs to the system. They double as an audit log of “what the system can do.”

#### application/handlers.py

Purpose

Execute a single use case

Contains

Command → orchestration logic

Calls domain methods

Coordinates repositories

def handle_process_document(cmd: ProcessDocument):
    doc = repo.get(cmd.document_id)
    doc.start_processing()
    repo.save(doc)

Does NOT contain

Celery decorators

HTTP details

Handlers should be callable from:

Celery

FastAPI

CLI

Tests

#### application/workflows.py

Purpose

Long-running or multi-step processes

Cross-aggregate coordination

Contains

Retry logic

Saga-style orchestration

Compensation steps

def document_ingestion_workflow(doc_id: DocumentId):
    extract_text()
    classify()
    persist()

Rule of thumb
If it spans multiple handlers or systems, it’s a workflow.

#### application/queries.py (optional CQRS)

Purpose

Read-only use cases

Contains

Projections

Read models

Optimized queries

No domain mutations. Ever.

### infrastructure/ — Adapters to the real world

Golden rule: everything here is replaceable.

#### infrastructure/repositories.py

Purpose

Implement domain repository interfaces

Contains

asyncpg / raw SQL

Entity ↔ DB mapping

class PostgresDocumentRepository(DocumentRepository):
    def save(self, document: Document) -> None:
        ...

Does NOT contain

Business decisions

Validation rules

If logic breaks when you change DBs, it’s in the wrong layer.

#### infrastructure/event_publisher.py (if used)

Purpose

Publish domain events to queues, logs, or buses

Contains Redis  logic

Domain emits events → infrastructure delivers them.

Mental model (use this to self-check)

### Summary

Ask these questions:

Domain: “Is this rule still true if the internet is down?”

Application: “Is this how we do it, not what is true?”

Infrastructure: “Could I delete this and swap vendors?”