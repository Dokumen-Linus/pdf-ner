# Schema

### users
- id: uuid (pk)
- email: text (required)
- first_name: text
- last_name: text
- display_name: text
- employer: text
- job_title: text
- avatar_url: text

### aws_buckets
- id: uuid (pk)
- name: text (required)
- region: text (required)
- access_key_id: text (required, fk)
- secret_access_key: text (required)
- endpoint_url: text

### projects
- id: uuid (pk)
- owner_id: uuid (required, fk)
- name: text (required)
- description: text
- bucket_id: uuid (fk)

### std_entity_types
- id: bigint (pk)
- short_name: text (required)
- category: text (required)
- definition: text (required)
- format_description: text
- regex: text
- exact_length: integer
- like: 9 for ssn
  single_word boolean

### entity_types
- id: uuid (pk)
- project_id: uuid (required, fk)
- name: text (required)
- standard_entity_type_id: bigint (fk)
- user_format_description: text
- single_word: boolean
- exact_length: integer
- required: boolean (required)

### templates
- id: bigint (pk)
- txt: text (required)
- document_at_end: boolean (required)

### prompts
- id: uuid (pk)
- project_id: uuid (required, fk)
- template_id: bigint (fk)
- full_text: text

### pdfs
- id: uuid (pk)
- name: text
- bucket_id: uuid (required, fk)
- filepath: text (required)
- text_by_page: jsonb
- text_by_bookmarks: jsonb
- model: text
- prompt_id: uuid (fk)

### annotations
- id: uuid (pk)
- subtype: text (required)
- rect: jsonb (required)
- segment_rects: jsonb (required)
- page_index: integer (required)
- color: text
- opacity: real
- contents: text
- custom_entity_type: text
- author: text
- created: timestamp

### optimized_prompts
- id: uuid (pk)
- project_id: uuid (required, fk)
- full_text: text (required)

### prompt_evaluations
- id: uuid (pk)
- prompt_id: uuid (required, fk)
- overall_f1: real (required)
- per_entity_scores: jsonb (required)

### llm_usage
- id: uuid (pk)
- user_id: uuid (fk)
- project_id: uuid (fk)
- provider: text (required)
- model: text (required)
- source: text (required)
- task_name: text
- input_tokens: integer (required)
- output_tokens: integer (required)
- cost_usd: numeric(12
- stripe_reported: boolean (required)
- stripe_usage_event_id: text (fk)

### stripe_customers
- id: uuid (pk)
- user_id: uuid (required, fk)
- stripe_customer_id: text (required, fk)
- stripe_subscription_id: text (fk)
- stripe_subscription_item_id: text (fk)

### models
- id: text (pk)
- provider: text (required)
- usd_per_1m_input: numeric(10
- usd_per_1m_output: numeric(10
- release_date: timestamp(tz) (required)
- available_date: timestamp(tz) (required)
- end_available_date: timestamp(tz)

### user
- id: text (pk, required)
- name: text (required)
- email: text (required)
- emailVerified: boolean (required)
- image: text

### session
- id: text (pk, required)
- expiresAt: timestamp(tz) (required)
- token: text (required)
- ipAddress: text
- userAgent: text
- userId: text (required, fk)

### account
- id: text (pk, required)
- accountId: text (required, fk)
- providerId: text (required, fk)
- userId: text (required, fk)
- accessToken: text
- refreshToken: text
- idToken: text
- accessTokenExpiresAt: timestamp(tz)
- refreshTokenExpiresAt: timestamp(tz)
- scope: text
- password: text

### verification
- id: text (pk, required)
- identifier: text (required)
- value: text (required)
- expiresAt: timestamp(tz) (required)
