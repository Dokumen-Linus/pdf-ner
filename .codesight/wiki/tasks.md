# Tasks

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Tasks subsystem handles **1 routes** and touches: cache.

## Routes

- `GET` `/api/v1/tasks/{task_id}/status` params(task_id) [cache]
  `api/app/domains/uat_worker_dispatch/router.py`

## Source Files

Read these before implementing or modifying this subsystem:
- `api/app/domains/uat_worker_dispatch/router.py`

---
_Back to [overview.md](./overview.md)_