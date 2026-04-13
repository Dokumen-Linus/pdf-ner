# Buckets

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Buckets subsystem handles **1 routes** and touches: auth.

## Routes

- `POST` `/api/v1/buckets` → in: CreateBucketRequest [auth, upload]
  `api/app/domains/pdf_storage/router.py`

## Source Files

Read these before implementing or modifying this subsystem:
- `api/app/domains/pdf_storage/router.py`

---
_Back to [overview.md](./overview.md)_