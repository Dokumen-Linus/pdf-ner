# Text-extract

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Text-extract subsystem handles **2 routes** and touches: cache.

## Routes

- `POST` `/api/v1/text-extract` → in: OptimizePromptRequest [cache]
  `api/app/domains/worker_dispatch/router.py`
- `GET` `/api/v1/text-extract/{task_id}/status` params(task_id) [cache]
  `api/app/domains/worker_dispatch/router.py`

## Related Models

- **extract_methods** (3 fields) → [database.md](./database.md)

## Source Files

Read these before implementing or modifying this subsystem:
- `api/app/domains/worker_dispatch/router.py`

---
_Back to [overview.md](./overview.md)_