# pdf-ner — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**pdf-ner** is a typescript project built with fastapi, celery, using drizzle for data persistence, organized as a microservices repo.

**Services:** `api` (`api`), `deepseek-ocr` (`gpu/deepseek-ocr`), `olm-ocr2` (`gpu/olm-ocr2`), `dokumen-web` (`web`), `workers` (`workers`)

## Scale

16 API routes · 1 database models · 81 UI components · 48 library files · 21 middleware layers · 84 environment variables

## Subsystems

- **[Avatars](./avatars.md)** — 1 routes — touches: upload
- **[Buckets](./buckets.md)** — 1 routes — touches: auth, upload
- **[Extract](./extract.md)** — 1 routes — touches: cache
- **[Extract-text](./extract-text.md)** — 1 routes
- **[Highlight](./highlight.md)** — 1 routes
- **[Ocr](./ocr.md)** — 1 routes — touches: auth, cache
- **[Optimize-prompt](./optimize-prompt.md)** — 2 routes — touches: cache
- **[Pdfs](./pdfs.md)** — 2 routes — touches: auth, upload
- **[Test_telemetry](./test_telemetry.md)** — 1 routes — touches: auth, cache
- **[Infra](./infra.md)** — 5 routes — touches: auth, db, cache

**Database:** drizzle, 1 models — see [database.md](./database.md)

**UI:** 81 components (react) — see [ui.md](./ui.md)

**Libraries:** 48 files — see [libraries.md](./libraries.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `web/src/components/pdf-container/plugin-viewport-2/index.ts` — imported by **13** files
- `web/src/components/pdf-container/plugin-annotation-2/lib/types.ts` — imported by **11** files
- `web/src/components/pdf-container/plugin-scroll-2/index.ts` — imported by **10** files
- `//infrastructure.py` — imported by **10** files
- `///application/schemas.py` — imported by **10** files
- `/config.py` — imported by **8** files

## Required Environment Variables

- `API_KEY` — `api/tests/conftest.py`
- `AVATARS_S3_BUCKET_NAME` — `infra/init/.env.example`
- `BASE_URL` — `web/src/integrations/sitemap.ts`
- `CI` — `web/playwright.config.ts`
- `DATABASE_URL` — `web/tests/bun-test-setup/db-setup.ts`
- `DEEPSEEK_IMAGE` — `infra/runpod/.env.example`
- `DEPLOYMENT` — `packages/otel_py/otel_py/config.py`
- `DEV` — `web/src/client.tsx`
- `GITHUB_OIDC_THUMBPRINT` — `infra/init/.env.example`
- `GPU_MEMORY_UTILIZATION` — `gpu/olm-ocr2/app.py`
- `HF_TOKEN` — `infra/runpod/.env.example`
- `MAX_MODEL_LEN` — `gpu/olm-ocr2/app.py`
- _...22 more_

---
_Back to [index.md](./index.md) · Generated 2026-05-11_