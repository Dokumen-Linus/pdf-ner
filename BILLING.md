# Billing Contract

This document describes the project-based billing contract for Dokumen AI.

The short version: `workers.llm_usage` is the immutable ledger of billable LLM
events. The web app owns subscription setup, local subscription state, and
authorization. FastAPI and workers record usage only; Stripe is updated from
usage batches, not per LLM call.

## Ownership Model

Users, organizations, teams, and projects relate like this:

- `web.users` is the app-level user record. It maps to `auth.user` through
  `auth_user_id`.
- A user may belong to an organization through Better Auth membership rows.
  The local mirror is `web.users.organization_id`.
- `web.organizations` mirrors `auth.organization` and stores organization
  subscription state.
- `web.teams` mirrors `auth.team`. Teams belong to organizations.
- `web.projects` owns product work. A project is billed and authorized through
  one of two shapes:
  - Personal project: `projects.team_id IS NULL`, and `projects.owner_id`
    identifies the user who is billed.
  - Organization project: `projects.team_id IS NOT NULL`; the owning team
    belongs to an organization, and that organization is billed.

Projects should always be treated as the billing and authorization boundary for
product work. Do not bill directly from a PDF, prompt, run, or task without
resolving the project first.

## `llm_usage` Contract

`workers.llm_usage` defines a billable LLM event. One row means one billable LLM
call whose cost should be attributable to a project and eventually reportable to
Stripe.

Required contract fields:

- `id`: unique event ID.
- `project_id`: required project that caused the usage.
- `actor_user_id`: optional user who initiated the usage. This is attribution,
  not the billing target.
- `billing_user_id`: user billed for personal projects.
- `billing_organization_id`: organization billed for team-owned projects.
- `model_id`: exact `public.models.id` used for the call.
- `source`: `api` or `worker`.
- `task_name`: optional workflow/task name, useful for long Celery jobs.
- `input_tokens`: provider-reported input token count.
- `output_tokens`: provider-reported output token count.
- `input_cost_usd`: input cost snapshot at event time.
- `output_cost_usd`: output cost snapshot at event time.
- `cost_usd`: total event cost snapshot.
- `report_batch_id`: null until this event is included in a Stripe reporting
  batch.
- `created_at`: event time.

Exactly one billing target must be present:

- Personal project: `billing_user_id IS NOT NULL` and
  `billing_organization_id IS NULL`.
- Organization project: `billing_user_id IS NULL` and
  `billing_organization_id IS NOT NULL`.

The billing target is intentionally stored on each usage row. That makes the
event self-contained and auditable even if project ownership or membership
changes later.

## Writing Usage

API and worker code should record usage after a successful LLM call by:

1. Resolving the project.
2. Resolving the bill-to target from the project:
   - If the project has a team, bill the team organization.
   - Otherwise bill the project owner.
3. Reading model pricing from `public.models`.
4. Inserting one `workers.llm_usage` row with model ID, input tokens, output
   tokens, costs, project ID, optional actor user, and source/task metadata.

Current implementations:

- FastAPI LLM NER writes usage in `api/app/domains/llm_ner/repository.py`.
- Worker workflows write usage through
  `workers/app/domains/billing/infrastructure/repository.py`.
- Context engineering reports accumulated project usage at workflow completion
  by calling the batch reporter.

Usage recording must not call Stripe. This is what keeps high-volume usage
cheap and resilient.

## Stripe Reporting

Stripe is updated from batches, not per event.

`workers.llm_usage_report_batches` records each aggregate report to Stripe. A
batch contains:

- billing target,
- reporting window,
- usage count,
- input and output token totals,
- total cost,
- Stripe usage record ID,
- status and timestamps.

Batch reporting flow:

1. Select unreported `llm_usage` rows where `report_batch_id IS NULL`.
2. Group by billing target and Stripe metered subscription item.
3. Convert total USD cost to the metered quantity expected by the Stripe price.
4. Create one Stripe usage record for the aggregate.
5. Insert a `llm_usage_report_batches` row.
6. Link all included `llm_usage` rows to that batch.

This supports both:

- scheduled weekly reporting; and
- task-end reporting for long-running workflows, such as context engineering.

Stripe owns invoices, payment collection, retries, and dunning. Local billing
tables explain exactly how the metered charge was formed.

## Subscription State

The web app owns subscription setup and local subscription state.

For personal billing, subscription fields live on `web.users`:

- `subscription_type`
- `stripe_customer_id`
- `stripe_subscription_id`
- `stripe_subscription_status`
- `stripe_developer_item_id`
- `stripe_usage_item_id`
- current period timestamps

For organization billing, subscription fields live on `web.organizations`:

- `stripe_customer_id`
- `stripe_subscription_id`
- `stripe_subscription_status`
- `stripe_developer_item_id`
- `stripe_analyst_item_id`
- `stripe_usage_item_id`
- current period timestamps

The app should use local database state for authorization and UI. It should not
fetch Stripe live to decide whether a user can access a page.

Stripe Checkout and Customer Portal are created from TanStack Start server
functions. Stripe webhooks reconcile subscription state back into
`web.users` or `web.organizations`.

FastAPI should not create Stripe customers, subscriptions, setup intents, or
payment methods.

## Authorization

Authorization is split into two layers.

### Project Authorization

Project authorization answers: "Can this user access this project?"

This belongs in `web/src/lib/project-authorization.server.ts`.

It resolves:

- authenticated app user,
- project owner,
- project team,
- organization membership,
- team membership,
- project access flags.

Project access modes:

- `read`: can view project outputs and metadata.
- `label`: can label/check project documents.
- `manage`: can manage project configuration and developer workflows.

Project authorization should not make subscription or billing-tier decisions.

### Role and Subscription Authorization

Role/subscription authorization answers: "Given project access, what actions can
this user perform?"

This belongs in `web/src/lib/role-authorization.server.ts`.

Current tiers:

- `developer`: full project permissions, including billing, uploads, entity
  types, project settings, engineering, labeling, checking, and output views.
- `analyst`: limited permissions for labeling documents, checking/correcting
  labeled documents, and viewing outputs.

Billing UI access requires both:

1. project authorization for the selected project or billing target; and
2. developer-level role/subscription permission.

## Web App Usage Patterns

Use project authorization for resource confinement:

- project routes,
- project data reads,
- PDF reads,
- annotation reads/writes,
- project-scoped API calls.

Use role/subscription authorization for capability checks:

- billing UI,
- Stripe Checkout/Portal actions,
- document uploads,
- entity type edits,
- project settings edits,
- prompt engineering,
- future team or billing administration.

Recommended pattern:

1. Resolve project access with `requireProjectAccess` or
   `getCurrentProjectAccess`.
2. Apply `requirePermission` or `requireProjectPermission` for the specific
   action.
3. Only then perform the DB write, API proxy, or Stripe action.

Do not duplicate SQL authorization logic in routes. Put reusable authorization
logic in the authorization helper modules.

## Billing Examples

Personal project:

1. User creates a project with no team.
2. LLM call runs for that project.
3. Usage row stores `project_id`, `actor_user_id`, `billing_user_id`, model ID,
   tokens, and cost snapshots.
4. Weekly batch reports that user's aggregate usage to the user's Stripe
   metered item.

Organization project:

1. Developer creates a project for a team.
2. LLM call runs for that project.
3. Usage row stores `project_id`, optional `actor_user_id`,
   `billing_organization_id`, model ID, tokens, and cost snapshots.
4. Weekly or task-end batch reports that organization's aggregate usage to the
   organization Stripe metered item.

Long-running Celery workflow:

1. Workflow records multiple `llm_usage` rows as LLM calls complete.
2. At workflow completion or checkpoint, the worker batch reporter can flush
   unreported rows for that project.
3. Rows are linked to a report batch only after successful Stripe reporting.

## Rules of Thumb

- `llm_usage` is the source of truth for billable events.
- `llm_usage_report_batches` is the source of truth for what was reported to
  Stripe.
- `web.users` and `web.organizations` are the source of truth for local
  subscription state.
- Web owns Stripe subscription setup and authorization.
- API and workers record usage; they do not manage subscriptions.
- Never charge or report to Stripe once per LLM call.
- Always resolve billing through the project.
