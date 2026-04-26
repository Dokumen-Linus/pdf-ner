# pdf-ner — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**pdf-ner** is a typescript project built with fastapi, celery, using drizzle for data persistence, organized as a microservices repo.

**Services:** `api` (`api`), `deepseek-ocr` (`gpu/deepseek-ocr`), `olm-ocr2` (`gpu/olm-ocr2`), `dokumen-web` (`web`), `workers` (`workers`)

## Scale

15 API routes · 1 database models · 81 UI components · 44 library files · 22 middleware layers · 60 environment variables

## Subsystems

- **[Avatars](./avatars.md)** — 1 routes — touches: upload
- **[Buckets](./buckets.md)** — 1 routes — touches: auth, upload
- **[Extract](./extract.md)** — 1 routes — touches: cache
- **[Extract-text](./extract-text.md)** — 1 routes
- **[Highlight](./highlight.md)** — 1 routes
- **[Ocr](./ocr.md)** — 1 routes — touches: auth, cache
- **[Optimize-prompt](./optimize-prompt.md)** — 2 routes — touches: cache
- **[Pdfs](./pdfs.md)** — 2 routes — touches: auth, upload
- **[Test_telemetry](./test_telemetry.md)** — 1 routes — touches: cache
- **[Infra](./infra.md)** — 4 routes — touches: db, cache

**Database:** drizzle, 1 models — see [database.md](./database.md)

**UI:** 81 components (react) — see [ui.md](./ui.md)

**Libraries:** 44 files — see [libraries.md](./libraries.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `web/src/components/pdf-container/plugin-viewport-2/index.ts` — imported by **13** files
- `web/src/components/pdf-container/plugin-annotation-2/lib/types.ts` — imported by **11** files
- `web/src/components/pdf-container/plugin-scroll-2/index.ts` — imported by **10** files
- `///application/schemas.py` — imported by **10** files
- `web/src/db/schemas/web/schema.ts` — imported by **8** files
- `/common.py` — imported by **8** files

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
_Back to [index.md](./index.md) · Generated 2026-04-26_