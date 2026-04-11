---
name: dokumen-billing
description: >
  Complete billing system for Dokumen AI. Covers LLM usage tracking in api and
  workers, Stripe customer/subscription/SetupIntent management, metered billing
  reporting, public.models pricing table, web server functions (TanStack Start),
  billing.tsx route, and workers DDD billing domain. Load when modifying any
  billing, usage tracking, Stripe, llm_usage, stripe_customers, or public.models
  code across db, api, workers, or web.
type: core
library: dokumen-internal
library_version: "1.0"
sources:
  - "db/migrations/00090_create_billing_tables.sql"
  - "db/migrations/00091_create_models.sql"
  - "db/seeds/models.sql"
  - "api/app/domains/billing/"
  - "api/app/domains/shared/repository.py"
  - "api/app/domains/llm_ner/service.py"
  - "workers/app/domains/billing/"
  - "workers/app/shared/domain/LLMResponseData.py"
  - "web/src/db-fns/workers/billing.ts"
  - "web/src/db/schemas/workers/billing.ts"
  - "web/src/routes/_private/billing.tsx"
---

## Architecture Overview

```
LLM call (api or worker)
  └─ fetch cost from public.models
  └─ INSERT workers.llm_usage  (source = 'api' | 'worker')

Celery task: billing.report_usage_to_stripe  (periodic)
  └─ batch unreported rows by user
  └─ POST microdollar units to Stripe subscription_items.create_usage_record
  └─ UPDATE stripe_reported = TRUE

Web route /billing
  └─ getUsageSummary()     reads workers.llm_usage via Drizzle (web_user SELECT)
  └─ getStripeCustomer()   reads workers.stripe_customers
  └─ createSetupIntent()   calls Stripe API server-side
```

## Quickstart — Stripe Dashboard Setup

These steps must be completed before any billing code functions:

**1. Create a metered Price**
- Dashboard → Products → Add product → "LLM Usage"
- Add price: Recurring, Usage-based, Billing meter or legacy "Metered"
- Unit amount: `$0.000001` (1 microdollar per unit)
- Billing period: Monthly
- Save the `price_XXXX` ID → set as `STRIPE_METERED_PRICE_ID` env var or pass
  directly to `createMeteredSubscription({ priceId: "price_XXXX" })`

**2. Enable SetupIntents for saving cards**
- Dashboard → Settings → Payment methods → Enable "Cards"
- No webhook needed for SetupIntents unless you want confirmation events

**3. Set env vars** (all three services need `STRIPE_SECRET_KEY`):

```bash
# api/.env and workers/.env
STRIPE_SECRET_KEY=sk_live_...   # or sk_test_...

# web/.env
STRIPE_SECRET_KEY=sk_live_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**4. Seed public.models**

```bash
psql $DATABASE_URL -f db/seeds/models.sql
```

Without models in this table, all LLM usage records `cost_usd = 0`.

## DB Schema

### `workers.llm_usage` — one row per LLM call

```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES web.users(id) ON DELETE SET NULL
project_id UUID REFERENCES web.projects(id) ON DELETE SET NULL
provider TEXT NOT NULL                        -- 'anthropic' | 'openai' | 'google'
model TEXT NOT NULL                           -- matches public.models.id
source TEXT CHECK (source IN ('api','worker'))
task_name TEXT                                -- Celery task name when source='worker'
input_tokens INTEGER NOT NULL DEFAULT 0
output_tokens INTEGER NOT NULL DEFAULT 0
cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0   -- computed at insert time
stripe_reported BOOLEAN NOT NULL DEFAULT FALSE
stripe_usage_event_id TEXT                   -- Stripe UsageRecord.id after reporting
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Partial index** on `stripe_reported WHERE NOT stripe_reported` — Celery query
only scans unreported rows; never remove this index.

### `workers.stripe_customers` — one row per user

```sql
user_id UUID NOT NULL UNIQUE REFERENCES web.users(id) ON DELETE CASCADE
stripe_customer_id TEXT NOT NULL UNIQUE
stripe_subscription_id TEXT        -- NULL until user subscribes
stripe_subscription_item_id TEXT   -- required for create_usage_record
```

Reporting is skipped for users with `stripe_subscription_item_id IS NULL`.

### `public.models` — pricing source of truth

```sql
id TEXT PRIMARY KEY          -- exact model string passed to LLM API
provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google'))
usd_per_1m_input NUMERIC(10, 4) NOT NULL
usd_per_1m_output NUMERIC(10, 4) NOT NULL
release_date TIMESTAMPTZ NOT NULL
available_date TIMESTAMPTZ NOT NULL DEFAULT now()
end_available_date TIMESTAMPTZ     -- set when model is retired
```

`end_available_date IS NULL` means currently available. Both api and workers
query this table; the `api_user`, `web_user`, and `workers_user` roles all have
`USAGE ON SCHEMA public` and `SELECT ON public.models` (set in `_init.sql`).

### Role permissions summary

| Table | api_user | web_user | workers_user |
|-------|----------|----------|--------------|
| `workers.llm_usage` | INSERT | SELECT | INSERT |
| `workers.stripe_customers` | INSERT, UPDATE | INSERT, UPDATE | SELECT |
| `public.models` | SELECT | SELECT | SELECT |

## API Layer

### Recording usage after an LLM call

`api/app/domains/llm_ner/service.py` — called inside `extract_entities()`:

```python
from app.domains.shared.repository import fetch_model_cost
from app.domains.shared.schemas import LLMResponseData

llm_usage: LLMResponseData = await call_llm(clients, provider, model, sys, usr)

await record_llm_usage(
    conn, request.user_id, request.project_id,
    request.provider, request.model,
    llm_usage.input_tokens, llm_usage.output_tokens,
)
```

`record_llm_usage` (in `llm_ner/service.py`) calls `fetch_model_cost` from
`app.domains.shared.repository`, then INSERTs with `source = 'api'`.

### Billing REST endpoints (`/api/v1/billing/...`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/billing/customer` | Idempotent create Stripe customer |
| GET | `/billing/usage?user_id=&days=` | Usage summary for dashboard |
| POST | `/billing/subscription` | Create metered subscription |
| DELETE | `/billing/subscription` | Cancel subscription |
| POST | `/billing/report-to-stripe` | Manually trigger Stripe reporting |

All routes use `asyncpg.Connection` from `Depends(get_conn)`. No `response_model`
is set (per project conventions).

### `fetch_model_cost` — shared pricing lookup

`api/app/domains/shared/repository.py`:

```python
async def fetch_model_cost(conn, model, input_tokens, output_tokens) -> Decimal:
    row = await conn.fetchrow(
        "SELECT usd_per_1m_input, usd_per_1m_output FROM public.models "
        "WHERE id = $1 AND (end_available_date IS NULL OR end_available_date > now())",
        model,
    )
    if not row:
        logger.warning("Model not found: %s — cost = 0", model)
        return Decimal("0")
    cost = (input_tokens * float(row["usd_per_1m_input"])
            + output_tokens * float(row["usd_per_1m_output"])) / 1_000_000
    return Decimal(str(round(cost, 8)))
```

`workers/app/domains/billing/infrastructure/repository.py` contains an
identical function for the workers package (separate Python package, cannot
share code).

## Workers Layer (DDD)

```
workers/app/domains/billing/
├── tasks.py                         # @app.task thin wrapper only
├── application/workflows.py         # report_usage_to_stripe() orchestration
├── domain/services.py               # cost_to_microdollars() pure logic
└── infrastructure/repository.py    # fetch_model_cost, record_llm_usage,
                                     # get_unreported_batches, mark_reported
```

### `record_llm_usage` — called from other worker domains

```python
# workers/app/domains/context_engineering/application/workflows.py
from app.domains.billing.infrastructure.repository import record_llm_usage
from app.shared.domain.LLMResponseData import LLMResponseData

llm_response: LLMResponseData = await call_openai(client, model, sys, usr)
await record_llm_usage(
    conn, provider="openai", model=model,
    input_tokens=llm_response.input_tokens,
    output_tokens=llm_response.output_tokens,
    project_id=cmd.project_id, task_name=_TASK_NAME,
)
```

`record_llm_usage` in workers internally calls `fetch_model_cost` (DB lookup),
then INSERTs with `source = 'worker'`.

### Stripe reporting task

`tasks.py` fires `billing.report_usage_to_stripe` (schedule via Celery beat).
The workflow in `application/workflows.py`:

1. `get_unreported_batches(conn)` — GROUP BY user + subscription item, SUM cost
2. `cost_to_microdollars(total_cost_usd)` — `int(cost * 1_000_000)`; skip if ≤ 0
3. `stripe.subscription_items.create_usage_record(item_id, quantity=units, action="increment")`
4. `mark_reported(conn, usage_ids, record.id)` — sets `stripe_reported = TRUE`

`LLMResponseData` dataclass lives in `workers/app/shared/domain/LLMResponseData.py`.
Import as `from app.shared.domain.LLMResponseData import LLMResponseData`.

## Web Layer

### Server functions — `web/src/db-fns/workers/billing.ts`

All functions authenticate via `requireUserId()` which calls
`auth.api.getSession({ headers })` server-side. No `userId` input parameter
is accepted from the client.

| Export | Method | What it does |
|--------|--------|--------------|
| `getUsageSummary()` | GET | Current month totals + byModel + byDay via Drizzle |
| `getStripeCustomer()` | GET | Row from `workers.stripe_customers` or null |
| `ensureStripeCustomer({ email, name? })` | POST | Idempotent Stripe customer + DB upsert |
| `createSetupIntent()` | POST | Requires existing customer; returns `clientSecret` |
| `createMeteredSubscription({ priceId })` | POST | Creates subscription, stores item ID |

### Billing route — `web/src/routes/_private/billing.tsx`

Route is under `_private` layout which guarantees session exists before render.
Loader uses `context.session.user.id` (no optional chaining needed):

```typescript
loader: async ({ context }) => {
  const userId = context.session.user.id  // always defined under _private
  const [{ clientSecret }, usage, stripeCustomer] = await Promise.all([
    createSetupIntent(),
    getUsageSummary(),
    getStripeCustomer(),
  ])
  return { clientSecret, usage, stripeCustomer }
}
```

`costUsd` from `llmUsage.costUsd` is `numeric` in Postgres → arrives as string
in JS. The server functions explicitly cast: `sql<number>\`coalesce(sum(...), 0)\``
and wrap with `Number(r.costUsd)` before returning.

### Drizzle schema — `web/src/db/schemas/workers/billing.ts`

```typescript
import { workersSchema } from "./schema"

export const llmUsage = workersSchema.table("llm_usage", { ... })
export const stripeCustomers = workersSchema.table("stripe_customers", { ... })
```

`workersSchema = pgSchema("workers")` — Drizzle targets the `workers` PostgreSQL
schema. `web_user` has SELECT on both tables, INSERT/UPDATE on `stripe_customers`.

## Common Mistakes

### HIGH — Importing LLMResponseData from old location

Wrong:
```python
# workers
from workers.app.shared.domain.LLMResponseData import LLMResponseData
# api
from app.shared.schemas import LLMResponseData
```

Correct:
```python
# workers — always use app.* (run from workers/ directory)
from app.shared.domain.LLMResponseData import LLMResponseData
# api
from app.domains.shared.schemas import LLMResponseData
```

`workers.app.*` prefix only resolves if run from the repo root; the Celery
worker runs from `workers/`. `app.shared.schemas` does not exist in api.

### HIGH — Stripe reporting skips users without subscription_item_id

Wrong:
```python
# Assuming all customers with stripe_customer_id will receive usage reports
```

Correct: A user must have `stripe_subscription_item_id IS NOT NULL` in
`workers.stripe_customers` before usage is reported. Creating a customer
(`POST /billing/customer`) is not enough — `createMeteredSubscription` must
also be called to populate `stripe_subscription_item_id`.

### HIGH — Missing model in public.models causes silent $0 cost recording

Wrong:
```python
# Deploying a new model without adding it to the seeds file
```

Correct:
```sql
-- db/seeds/models.sql
INSERT INTO public.models (id, provider, usd_per_1m_input, usd_per_1m_output, release_date)
VALUES ('new-model-id', 'anthropic', 3.00, 15.00, '2026-01-01')
ON CONFLICT (id) DO UPDATE SET usd_per_1m_input = EXCLUDED.usd_per_1m_input, ...;
```

`fetch_model_cost` returns `Decimal("0")` and logs a warning — no exception is
raised, so usage rows accumulate with `cost_usd = 0` silently.

### MEDIUM — Using optional chaining on session in _private routes

Wrong:
```typescript
// In any route under _private layout
const userId = context.session?.user?.id
if (!userId) return fallback
```

Correct:
```typescript
const userId = context.session.user.id  // _private.tsx throws redirect if no session
```

`_private.tsx` `beforeLoad` throws `redirect("/signin")` before the child
loader runs. Optional chaining here masks logic errors and causes stale
`clientSecret: ""` fallbacks to reach the Stripe Elements component.

### MEDIUM — costUsd arrives as string from Drizzle numeric column

Wrong:
```typescript
const total = usage.totalCostUsd + fee  // NaN — totalCostUsd is "0.00000100"
```

Correct:
```typescript
// server fn already wraps: totalCostUsd: Number(totals?.totalCostUsd ?? 0)
// If adding a new numeric aggregate, always wrap with Number():
totalCostUsd: sql<number>`coalesce(sum(${llmUsage.costUsd}::numeric), 0)`
// and in return: Number(totals?.totalCostUsd ?? 0)
```

Drizzle returns PostgreSQL `numeric` columns as strings. `sql<number>` is a
type-only cast — the runtime value is still a string without explicit `Number()`.

### MEDIUM — Adding a new worker domain that calls LLMs without recording usage

Wrong:
```python
# New domain calling an LLM but not recording usage
result = await call_openai(client, model, sys, usr)
return result.text
```

Correct:
```python
from app.domains.billing.infrastructure.repository import record_llm_usage

result: LLMResponseData = await call_openai(client, model, sys, usr)
await record_llm_usage(
    conn, provider="openai", model=model,
    input_tokens=result.input_tokens, output_tokens=result.output_tokens,
    project_id=project_id, task_name=_TASK_NAME,
)
```

Workers that skip `record_llm_usage` produce unbilled usage with no audit trail.
