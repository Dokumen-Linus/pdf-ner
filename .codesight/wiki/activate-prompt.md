# Activate-prompt

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Activate-prompt subsystem handles **2 routes** and touches: cache.

## Routes

- `POST` `/api/v1/activate-prompt` → in: OptimizePromptRequest [cache]
  `api/app/domains/worker_dispatch/router.py`
- `GET` `/api/v1/activate-prompt/{task_id}/status` params(task_id) [cache]
  `api/app/domains/worker_dispatch/router.py`

## Source Files

Read these before implementing or modifying this subsystem:
- `api/app/domains/worker_dispatch/router.py`

---
_Back to [overview.md](./overview.md)_