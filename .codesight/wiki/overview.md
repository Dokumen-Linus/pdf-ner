# pdf-ner — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**pdf-ner** is a mixed project built with fastapi, using drizzle for data persistence, organized as a monorepo.

**Workspaces:** `api` (`api`), `dokumen-web` (`web`)

## Scale

11 API routes · 18 database models · 54 UI components · 129 library files · 11 middleware layers · 36 environment variables

## Subsystems

- **[Payments](./payments.md)** — 2 routes — touches: db, payment
- **[Buckets](./buckets.md)** — 1 routes — touches: upload
- **[Customer](./customer.md)** — 1 routes — touches: db, payment
- **[Extract](./extract.md)** — 1 routes — touches: cache
- **[Highlight](./highlight.md)** — 1 routes
- **[Optimize-prompt](./optimize-prompt.md)** — 2 routes — touches: cache
- **[Pdfs](./pdfs.md)** — 1 routes — touches: upload
- **[Report-to-stripe](./report-to-stripe.md)** — 1 routes — touches: db, payment
- **[Usage](./usage.md)** — 1 routes — touches: db, payment

**Database:** unknown, 18 models — see [database.md](./database.md)

**UI:** 54 components (react) — see [ui.md](./ui.md)

**Libraries:** 129 files — see [libraries.md](./libraries.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `web\src\components\pdf-container\plugin-annotation-2\lib\types.ts` — imported by **10** files
- `web\src\components\pdf-container\plugin-scroll-2\lib\types.ts` — imported by **7** files
- `web\src\components\pdf-container\plugin-selection-2\lib\types.ts` — imported by **7** files
- `web\src\db\schemas\web\projects.ts` — imported by **7** files
- `/schemas.py` — imported by **6** files
- `web\src\components\pdf-container\plugin-annotation-2\lib\state.ts` — imported by **6** files

## Required Environment Variables

- `ANTHROPIC_API_KEY` — `workers\.env.example`
- `CI` — `web\playwright.config.ts`
- `DEV` — `web\src\client.tsx`
- `GOOGLE_AI_API_KEY` — `workers\.env.example`
- `OPENAI_API_KEY` — `workers\.env.example`
- `SSR` — `web\src\routes\_private.tsx`
- `STRIPE_SECRET_KEY` — `workers\.env.example`
- `TEST_DB` — `web\src\db\drizzle-client.test.ts`

---
_Back to [index.md](./index.md) · Generated 2026-04-12_