# pdf-ner — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**pdf-ner** is a typescript project built with fastapi, celery, using drizzle for data persistence, organized as a microservices repo.

**Services:** `api` (`api`), `deepseek-ocr` (`gpu/deepseek-ocr`), `olm-ocr2` (`gpu/olm-ocr2`), `dokumen-web` (`web`), `workers` (`workers`)

## Scale

19 API routes · 1 database models · 80 UI components · 42 library files · 20 middleware layers · 60 environment variables

## Subsystems

- **[Payments](./payments.md)** — 2 routes — touches: db, payment
- **[Avatars](./avatars.md)** — 1 routes — touches: upload
- **[Buckets](./buckets.md)** — 1 routes — touches: auth, upload
- **[Customer](./customer.md)** — 1 routes — touches: db, payment
- **[Extract](./extract.md)** — 1 routes — touches: cache
- **[Highlight](./highlight.md)** — 1 routes
- **[Ocr](./ocr.md)** — 1 routes — touches: auth, cache
- **[Optimize-prompt](./optimize-prompt.md)** — 2 routes — touches: cache
- **[Pdfs](./pdfs.md)** — 2 routes — touches: auth, upload
- **[Report-to-stripe](./report-to-stripe.md)** — 1 routes — touches: db, payment
- **[Test_telemetry](./test_telemetry.md)** — 1 routes — touches: cache
- **[Usage](./usage.md)** — 1 routes — touches: db, payment
- **[Infra](./infra.md)** — 4 routes — touches: db, cache

**Database:** drizzle, 1 models — see [database.md](./database.md)

**UI:** 80 components (react) — see [ui.md](./ui.md)

**Libraries:** 42 files — see [libraries.md](./libraries.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `web/src/components/pdf-container/plugin-viewport-2/index.ts` — imported by **13** files
- `web/src/components/pdf-container/plugin-annotation-2/lib/types.ts` — imported by **11** files
- `web/src/components/pdf-container/plugin-scroll-2/index.ts` — imported by **10** files
- `web/src/db/schemas/web/schema.ts` — imported by **8** files
- `/config.py` — imported by **7** files
- `web/src/components/pdf-container/plugin-annotation-2/index.ts` — imported by **7** files

## Required Environment Variables

- `ANTHROPIC_API_KEY` — `workers/.env.example`
- `API_KEY` — `infra/.env.example`
- `AVATARS_AWS_ACCESS_KEY_ID` — `infra/.env.example`
- `AVATARS_AWS_ENDPOINT_URL` — `infra/.env.example`
- `AVATARS_AWS_SECRET_ACCESS_KEY` — `infra/.env.example`
- `AVATARS_BUCKET` — `infra/.env.example`
- `AWS_ACCESS_KEY_ID` — `infra/.env.example`
- `AWS_ENDPOINT_URL` — `infra/.env.example`
- `AWS_SECRET_ACCESS_KEY` — `infra/.env.example`
- `CI` — `web/playwright.config.ts`
- `DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL` — `infra/.env.example`
- `DEPLOYMENT` — `packages/otel_py/otel_py/config.py`
- _...22 more_

---
_Back to [index.md](./index.md) · Generated 2026-04-25_