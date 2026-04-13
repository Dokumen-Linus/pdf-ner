# Report-to-stripe

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Report-to-stripe subsystem handles **1 routes** and touches: db, payment.

## Routes

- `POST` `/api/v1/report-to-stripe` → in: CreateCustomerRequest, out: None [db, payment]
  `api\app\domains\billing\router.py`

## Related Models

- **stripe_customers** (5 fields) → [database.md](./database.md)

## Source Files

Read these before implementing or modifying this subsystem:
- `api\app\domains\billing\router.py`

---
_Back to [overview.md](./overview.md)_