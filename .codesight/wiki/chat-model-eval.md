# Chat-model-eval

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Chat-model-eval subsystem handles **2 routes** and touches: cache.

## Routes

- `POST` `/api/v1/chat-model-eval` → in: OptimizePromptRequest [cache]
  `api/app/domains/worker_dispatch/router.py`
- `GET` `/api/v1/chat-model-eval/{task_id}/status` params(task_id) [cache]
  `api/app/domains/worker_dispatch/router.py`

## Related Models

- **chat_models** (3 fields) → [database.md](./database.md)

## Source Files

Read these before implementing or modifying this subsystem:
- `api/app/domains/worker_dispatch/router.py`

---
_Back to [overview.md](./overview.md)_