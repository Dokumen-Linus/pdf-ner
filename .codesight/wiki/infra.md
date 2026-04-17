# Infra

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Infra subsystem handles **4 routes** and touches: db, cache.

## Routes

- `GET` `/healthz` [db, cache]
  `api/app/core/telemetry.py`
- `GET` `/readyz` [db, cache]
  `api/app/core/telemetry.py`
- `GET` `/metrics` [db, cache]
  `api/app/core/telemetry.py`
- `GET` `/ping` [cache]
  `api/tests/core/test_telemetry.py`

## Source Files

Read these before implementing or modifying this subsystem:
- `api/app/core/telemetry.py`
- `api/tests/core/test_telemetry.py`

---
_Back to [overview.md](./overview.md)_