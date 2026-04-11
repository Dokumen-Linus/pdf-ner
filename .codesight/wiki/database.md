# Database

> **Navigation aid.** Schema shapes and field types extracted via AST. Read the actual schema source files before writing migrations or query logic.

**unknown** — 18 models

### users

pk: `id` (uuid)

- `id`: uuid _(pk)_
- `email`: text _(required)_
- `first_name`: text
- `last_name`: text
- `display_name`: text
- `employer`: text
- `job_title`: text
- `avatar_url`: text

### projects

pk: `id` (uuid) · fk: owner_id

- `id`: uuid _(pk)_
- `owner_id`: uuid _(required, fk)_
- `name`: text _(required)_
- `description`: text
- `bucket`: text

### std_entity_types

pk: `id` (bigint)

- `id`: bigint _(pk)_
- `short_name`: text _(required)_
- `category`: text _(required)_
- `definition`: text _(required)_
- `format_description`: text
- `regex`: text
- `exact_length`: integer
- `like`: 9 for ssn
  single_word boolean

### entity_types

pk: `id` (uuid) · fk: project_id, standard_entity_type_id

- `id`: uuid _(pk)_
- `project_id`: uuid _(required, fk)_
- `name`: text _(required)_
- `standard_entity_type_id`: bigint _(fk)_
- `user_format_description`: text
- `single_word`: boolean
- `exact_length`: integer
- `required`: boolean _(required)_

### templates

pk: `id` (bigint)

- `id`: bigint _(pk)_
- `txt`: text _(required)_
- `document_at_end`: boolean _(required)_

### prompts

pk: `id` (uuid) · fk: project_id, template_id

- `id`: uuid _(pk)_
- `project_id`: uuid _(required, fk)_
- `template_id`: bigint _(fk)_
- `full_text`: text

### aws_buckets

pk: `id` (uuid) · fk: access_key_id

- `id`: uuid _(pk)_
- `name`: text _(required)_
- `region`: text _(required)_
- `access_key_id`: text _(required, fk)_
- `secret_access_key`: text _(required)_
- `endpoint_url`: text

### pdfs

pk: `id` (uuid) · fk: bucket_id, prompt_id

- `id`: uuid _(pk)_
- `name`: text
- `bucket_id`: uuid _(required, fk)_
- `filepath`: text _(required)_
- `text_by_page`: jsonb
- `text_by_bookmarks`: jsonb
- `model`: text
- `prompt_id`: uuid _(fk)_

### annotations

pk: `id` (uuid)

- `id`: uuid _(pk)_
- `subtype`: text _(required)_
- `rect`: jsonb _(required)_
- `segment_rects`: jsonb _(required)_
- `page_index`: integer _(required)_
- `color`: text
- `opacity`: real
- `contents`: text
- `custom_entity_type`: text
- `author`: text
- `created`: timestamp

### optimized_prompts

pk: `id` (uuid) · fk: project_id

- `id`: uuid _(pk)_
- `project_id`: uuid _(required, fk)_
- `full_text`: text _(required)_

### prompt_evaluations

pk: `id` (uuid) · fk: prompt_id

- `id`: uuid _(pk)_
- `prompt_id`: uuid _(required, fk)_
- `overall_f1`: real _(required)_
- `per_entity_scores`: jsonb _(required)_

### llm_usage

pk: `id` (uuid) · fk: user_id, project_id, stripe_usage_event_id

- `id`: uuid _(pk)_
- `user_id`: uuid _(fk)_
- `project_id`: uuid _(fk)_
- `provider`: text _(required)_
- `model`: text _(required)_
- `source`: text _(required)_
- `task_name`: text
- `input_tokens`: integer _(required)_
- `output_tokens`: integer _(required)_
- `cost_usd`: numeric(12
- `stripe_reported`: boolean _(required)_
- `stripe_usage_event_id`: text _(fk)_

### stripe_customers

pk: `id` (uuid) · fk: user_id, stripe_customer_id, stripe_subscription_id, stripe_subscription_item_id

- `id`: uuid _(pk)_
- `user_id`: uuid _(required, fk)_
- `stripe_customer_id`: text _(required, fk)_
- `stripe_subscription_id`: text _(fk)_
- `stripe_subscription_item_id`: text _(fk)_

### models

pk: `id` (text)

- `id`: text _(pk)_
- `provider`: text _(required)_
- `usd_per_1m_input`: numeric(10
- `usd_per_1m_output`: numeric(10
- `release_date`: timestamp(tz) _(required)_
- `available_date`: timestamp(tz) _(required)_
- `end_available_date`: timestamp(tz)

### user

pk: `id` (text)

- `id`: text _(pk, required)_
- `name`: text _(required)_
- `email`: text _(required)_
- `emailVerified`: boolean _(required)_
- `image`: text

### session

pk: `id` (text) · fk: userId

- `id`: text _(pk, required)_
- `expiresAt`: timestamp(tz) _(required)_
- `token`: text _(required)_
- `ipAddress`: text
- `userAgent`: text
- `userId`: text _(required, fk)_

### account

pk: `id` (text) · fk: accountId, providerId, userId

- `id`: text _(pk, required)_
- `accountId`: text _(required, fk)_
- `providerId`: text _(required, fk)_
- `userId`: text _(required, fk)_
- `accessToken`: text
- `refreshToken`: text
- `idToken`: text
- `accessTokenExpiresAt`: timestamp(tz)
- `refreshTokenExpiresAt`: timestamp(tz)
- `scope`: text
- `password`: text

### verification

pk: `id` (text)

- `id`: text _(pk, required)_
- `identifier`: text _(required)_
- `value`: text _(required)_
- `expiresAt`: timestamp(tz) _(required)_

## Schema Source Files

Read and edit these files when adding columns, creating migrations, or changing relations:

- `/schemas.py` — imported by **6** files

---
_Back to [overview.md](./overview.md)_