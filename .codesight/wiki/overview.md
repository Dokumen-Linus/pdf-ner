# pdf-ner — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**pdf-ner** is a typescript project built with fastapi, celery, using drizzle for data persistence, organized as a microservices repo.

**Services:** `api` (`api`), `deepseek-ocr` (`gpu/deepseek-ocr`), `olm-ocr2` (`gpu/olm-ocr2`), `dokumen-web` (`web`), `workers` (`workers`)

## Scale

24 API routes · 3 database models · 78 UI components · 47 library files · 20 middleware layers · 121 environment variables

## Subsystems

- **[Activate-prompt](./activate-prompt.md)** — 2 routes — touches: cache
- **[Avatars](./avatars.md)** — 1 routes — touches: upload
- **[Buckets](./buckets.md)** — 1 routes — touches: auth, upload
- **[Chat-model-eval](./chat-model-eval.md)** — 2 routes — touches: cache
- **[Extract-text](./extract-text.md)** — 1 routes
- **[Highlight](./highlight.md)** — 1 routes
- **[Ocr](./ocr.md)** — 1 routes — touches: auth, cache
- **[Ocr-evaluation](./ocr-evaluation.md)** — 3 routes — touches: cache
- **[Optimize-prompt](./optimize-prompt.md)** — 2 routes — touches: cache
- **[Pdfs](./pdfs.md)** — 2 routes — touches: auth, upload
- **[Test_telemetry](./test_telemetry.md)** — 1 routes — touches: auth, cache
- **[Text-extract](./text-extract.md)** — 2 routes — touches: cache
- **[Infra](./infra.md)** — 5 routes — touches: auth, db, cache

**Database:** drizzle, 3 models — see [database.md](./database.md)

**UI:** 78 components (react) — see [ui.md](./ui.md)

**Libraries:** 47 files — see [libraries.md](./libraries.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `//infrastructure.py` — imported by **16** files
- `/commands.py` — imported by **16** files
- `//domain/entities.py` — imported by **15** files
- `web/src/components/pdf-container/plugin-viewport-2/index.ts` — imported by **13** files
- `web/src/components/pdf-container/plugin-annotation-2/lib/types.ts` — imported by **12** files
- `web/src/db/schemas/web/projects.ts` — imported by **11** files

## Required Environment Variables

- `API_KEY` — `api/tests/conftest.py`
- `BASE_URL` — `web/src/integrations/sitemap.ts`
- `COMPOSE_SERVICES` — `infra/init/.env.example`
- `DATABASE_URL` — `web/tests/bun-test-setup/db-setup.ts`
- `DEEPSEEK_RUNPOD_POD_ID` — `infra/runpod/.env.example`
- `DEPLOYMENT` — `packages/otel_py/otel_py/config.py`
- `DEV` — `web/src/client.tsx`
- `GITHUB_DEPLOY_KEY_PATH` — `infra/init/.env.example`
- `GPU_MEMORY_UTILIZATION` — `gpu/olm-ocr2/app.py`
- `HF_TOKEN` — `infra/runpod/.env.example`
- `MAX_MODEL_LEN` — `gpu/olm-ocr2/app.py`
- `MAX_NEW_TOKENS` — `gpu/olm-ocr2/app.py`
- _...23 more_

---
_Back to [index.md](./index.md) · Generated 2026-05-22_