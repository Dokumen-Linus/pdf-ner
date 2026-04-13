# Optimize-prompt

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Optimize-prompt subsystem handles **2 routes** and touches: cache.

## Routes

- `POST` `/api/v1/optimize-prompt` → in: ExtractEntitiesRequest [cache]
  `api\app\domains\llm_ner\router.py`
- `GET` `/api/v1/optimize-prompt/{task_id}/status` params(task_id) [cache]
  `api\app\domains\llm_ner\router.py`

## Related Models

- **prompt_evaluations** (4 fields) → [database.md](./database.md)

## Source Files

Read these before implementing or modifying this subsystem:
- `api\app\domains\llm_ner\router.py`

---
_Back to [overview.md](./overview.md)_