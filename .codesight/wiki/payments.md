# Payments

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Payments subsystem handles **2 routes** and touches: db, payment.

## Routes

- `POST` `/subscription` → in: CreateCustomerRequest, out: None [db, payment]
  `api\app\domains\billing\router.py`
- `DELETE` `/subscription` → in: CancelSubscriptionRequest, out: None [db, payment]
  `api\app\domains\billing\router.py`

## Source Files

Read these before implementing or modifying this subsystem:
- `api\app\domains\billing\router.py`

---
_Back to [overview.md](./overview.md)_