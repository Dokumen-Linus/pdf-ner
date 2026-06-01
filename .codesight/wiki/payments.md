# Payments

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Payments subsystem handles **3 routes** and touches: cache.

## Routes

- `POST` `/api/v1/billing/direct-payment` → in: DirectPaymentRequest [cache]
  `api/app/domains/uat_worker_dispatch/router.py`
- `POST` `/api/v1/billing/current-cycle` → in: DirectPaymentRequest [cache]
  `api/app/domains/uat_worker_dispatch/router.py`
- `POST` `/api/v1/billing/due-accounts` → in: DirectPaymentRequest [cache]
  `api/app/domains/uat_worker_dispatch/router.py`

## Source Files

Read these before implementing or modifying this subsystem:
- `api/app/domains/uat_worker_dispatch/router.py`

---
_Back to [overview.md](./overview.md)_