# Infra

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Infra subsystem handles **5 routes** and touches: auth, db, cache.

## Routes

- `GET` `/healthz` [auth, db, cache]
  `api/app/core/logging.py`
- `GET` `/readyz` [auth, db, cache]
  `api/app/core/logging.py`
- `GET` `/readyz/details` [auth, db, cache]
  `api/app/core/logging.py`
- `GET` `/metrics` [auth, db, cache]
  `api/app/core/logging.py`
- `GET` `/ping` [auth, cache]
  `api/tests/core/test_telemetry.py`

## Source Files

Read these before implementing or modifying this subsystem:
- `api/app/core/logging.py`
- `api/tests/core/test_telemetry.py`

---
_Back to [overview.md](./overview.md)_