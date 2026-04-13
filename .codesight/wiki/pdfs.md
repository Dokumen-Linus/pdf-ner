# Pdfs

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Pdfs subsystem handles **2 routes** and touches: auth.

## Routes

- `GET` `/api/v1/pdfs/{pdf_id}/url` params(pdf_id) → in: UUID [auth, upload]
  `api/app/domains/pdf_storage/router.py`
- `POST` `/api/v1/pdfs` → in: CreateBucketRequest [auth, upload]
  `api/app/domains/pdf_storage/router.py`

## Source Files

Read these before implementing or modifying this subsystem:
- `api/app/domains/pdf_storage/router.py`

---
_Back to [overview.md](./overview.md)_