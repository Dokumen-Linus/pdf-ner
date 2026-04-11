# Usage

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Usage subsystem handles **1 routes** and touches: db, payment.

## Routes

- `GET` `/usage` → in: UUI, out: None [db, payment]
  `api\app\domains\billing\router.py`

## Related Models

- **llm_usage** (12 fields) → [database.md](./database.md)

## Source Files

Read these before implementing or modifying this subsystem:
- `api\app\domains\billing\router.py`

---
_Back to [overview.md](./overview.md)_