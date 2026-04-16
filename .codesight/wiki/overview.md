# pdf-ner — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**pdf-ner** is a typescript project built with fastapi, using drizzle for data persistence, organized as a microservices repo.

**Services:** `api` (`api`), `dokumen-web` (`web`)

## Scale

13 API routes · 1 database models · 70 UI components · 19 library files · 17 middleware layers · 37 environment variables

## Subsystems

- **[Payments](./payments.md)** — 2 routes — touches: db, payment
- **[Avatars](./avatars.md)** — 1 routes — touches: upload
- **[Buckets](./buckets.md)** — 1 routes — touches: auth, upload
- **[Customer](./customer.md)** — 1 routes — touches: db, payment
- **[Extract](./extract.md)** — 1 routes — touches: cache
- **[Highlight](./highlight.md)** — 1 routes
- **[Optimize-prompt](./optimize-prompt.md)** — 2 routes — touches: cache
- **[Pdfs](./pdfs.md)** — 2 routes — touches: auth, upload
- **[Report-to-stripe](./report-to-stripe.md)** — 1 routes — touches: db, payment
- **[Usage](./usage.md)** — 1 routes — touches: db, payment

**Database:** drizzle, 1 models — see [database.md](./database.md)

**UI:** 70 components (react) — see [ui.md](./ui.md)

**Libraries:** 19 files — see [libraries.md](./libraries.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `web/src/components/pdf-container/plugin-viewport-2/index.ts` — imported by **13** files
- `web/src/components/pdf-container/plugin-annotation-2/lib/types.ts` — imported by **10** files
- `web/src/components/pdf-container/plugin-scroll-2/index.ts` — imported by **8** files
- `web/src/components/pdf-container/plugin-scroll-2/lib/types.ts` — imported by **7** files
- `web/src/components/pdf-container/plugin-selection-2/lib/types.ts` — imported by **7** files
- `web/src/db/schemas/web/projects.ts` — imported by **7** files

## Required Environment Variables

- `ANTHROPIC_API_KEY` — `workers/.env.example`
- `API_KEY` — `infra/.env.example`
- `AVATARS_AWS_ACCESS_KEY_ID` — `infra/.env.example`
- `AVATARS_AWS_ENDPOINT_URL` — `infra/.env.example`
- `AVATARS_AWS_SECRET_ACCESS_KEY` — `infra/.env.example`
- `AVATARS_BUCKET` — `infra/.env.example`
- `CI` — `web/playwright.config.ts`
- `DEV` — `web/src/client.tsx`
- `GOOGLE_AI_API_KEY` — `workers/.env.example`
- `OPENAI_API_KEY` — `workers/.env.example`
- `SSR` — `web/src/routes/_private.tsx`
- `STRIPE_SECRET_KEY` — `workers/.env.example`
- _...2 more_

---
_Back to [index.md](./index.md) · Generated 2026-04-16_