# Celery Worker App Agent Notes

## Architecture

- Celery worker app organized with domain-driven design layers.
- Keep Celery tasks thin; delegate immediately to application handlers.
- Application handlers should remain callable from Celery, FastAPI, CLI, and tests.

## Layer Rules

- `core/`: process wiring, config, and logging. No domain imports.
- `shared/`: stable shared kernel for cross-domain concepts only; not a generic utils folder.
- `integrations/`: cross-domain third-party clients that expose capability-focused APIs, not raw SDK calls.
- `domains/<name>/domain/`: pure business logic with no Celery, DB, HTTP, SDKs, or other I/O.
- `domains/<name>/application/`: use-case orchestration with no framework decorators.
- `domains/<name>/infrastructure/`: replaceable adapters to the real world.
- `domains/<name>/tasks.py`: thin Celery entrypoints.

## Domain Folder Roles

- `domain/entities.py`: long-lived objects with identity and invariants.
- `domain/value_objects.py`: immutable identity-less concepts with construction-time validation.
- `domain/services.py`: multi-entity business logic with zero I/O.
- `domain/policies.py`: declarative decision rules.
- `domain/events.py`: immutable records of things that happened.
- `domain/repositories.py`: persistence contracts only.
- `application/commands.py`: frozen dataclasses expressing intent.
- `application/handlers.py`: single use-case executors.
- `application/workflows.py`: multi-step processes and compensation.
- `application/queries.py`: read-only use cases.
- `infrastructure/repositories.py`: asyncpg/SQL implementations.
- `infrastructure/event_publisher.py`: domain event publishing.

## Database

- Only repository implementations may execute SQL.
- Repository interfaces live in the domain layer.
- SQL implementations are backed by the asyncpg DB layer in `workers/app/shared/infrastructure/db.py`.
- Do not model SQL tables as Python schemas; SQL execution is the source of truth for DB shape.

## Self-Check

- Domain: is this rule still true if the internet is down?
- Application: is this how we do it, not what is true?
- Infrastructure: could this be deleted and swapped for another vendor?
