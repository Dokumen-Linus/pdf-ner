# Usage

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Usage subsystem handles **1 routes** and touches: db, payment.

## Routes

- `GET` `/api/v1/usage` → in: UUI, out: None [db, payment]
  `api/app/domains/billing/router.py`

## Source Files

Read these before implementing or modifying this subsystem:
- `api/app/domains/billing/router.py`

---
_Back to [overview.md](./overview.md)_