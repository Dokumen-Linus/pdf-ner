# Extract

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Extract subsystem handles **1 routes** and touches: cache.

## Routes

- `POST` `/api/v1/extract` → in: ExtractEntitiesRequest [cache]
  `api/app/domains/llm_ner/router.py`

## Source Files

Read these before implementing or modifying this subsystem:
- `api/app/domains/llm_ner/router.py`

---
_Back to [overview.md](./overview.md)_