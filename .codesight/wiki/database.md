# Database

> **Navigation aid.** Schema shapes and field types extracted via AST. Read the actual schema source files before writing migrations or query logic.

**drizzle** — 3 models

### chat_models

pk: `id` (text)

- `id`: text _(pk)_
- `displayName`: text _(required)_
- `host`: text _(required)_

### extract_methods

pk: `id` (text)

- `id`: text _(pk)_
- `displayName`: text _(required)_
- `methodType`: text _(required)_

### source_providers

pk: `id` (text)

- `id`: text _(pk)_
- `provider`: text _(required)_
- `providerType`: text _(required)_
- `vendor`: text _(required)_

## Schema Source Files

Read and edit these files when adding columns, creating migrations, or changing relations:

- `web/src/db/schemas/web/projects.ts` — imported by **11** files
- `web/src/db/schemas/workers/schema.ts` — imported by **10** files
- `///application/schemas.py` — imported by **10** files
- `web/src/db/schemas/web/schema.ts` — imported by **9** files
- `web/src/db/schemas/web/users.ts` — imported by **7** files

---
_Back to [overview.md](./overview.md)_