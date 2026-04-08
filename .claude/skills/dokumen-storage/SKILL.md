---
name: dokumen-storage
description: >
  Dokumen AI PDF storage system: public.aws_buckets table with per-bucket S3
  credentials, workers.pdfs with bucket_id FK + filepath, cross-schema PDF
  records (workers/web/api), DB-first insert with S3 rollback pattern,
  boto3 per-bucket client creation, pdf_storage domain endpoints, pdf_utils
  and llm_ner PDF fetching. Use when creating buckets, uploading PDFs,
  downloading PDF bytes, or querying PDF storage.
type: core
---

# Dokumen Storage System

Multi-tenant PDF storage using per-bucket S3 credentials stored in the database.
No global AWS environment variables. Each bucket row carries its own
`access_key_id`, `secret_access_key`, `region`, and optional `endpoint_url`.

## Database Schema

### `public.aws_buckets` (migration 00049)

Source: `db/migrations/00049_create_aws_buckets.sql`

```sql
CREATE TABLE public.aws_buckets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  region            TEXT NOT NULL DEFAULT 'us-east-1',
  access_key_id     TEXT NOT NULL,
  secret_access_key TEXT NOT NULL,
  endpoint_url      TEXT,            -- NULL for real AWS, set for MinIO/LocalStack
  created_at        TIMESTAMPTZ DEFAULT now()
);
```

Grants: `api_user` gets SELECT/INSERT/UPDATE. `workers_user` gets SELECT only.

### `workers.pdfs` (migration 00050)

Source: `db/migrations/00050_create_workers_pdfs.sql`

```sql
CREATE TABLE workers.pdfs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT,
  bucket_id  UUID NOT NULL REFERENCES public.aws_buckets (id),
  filepath   TEXT NOT NULL,          -- S3 key: "{project_id}/{uuid}/{safe_name}"
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
  -- ... text extraction and NER result columns
);
```

### Cross-schema PDF records

When a PDF is created, rows are inserted into three schemas:
1. `workers.pdfs` - primary record with bucket_id, filepath, project_id
2. `web.pdfs` - references workers.pdfs.id
3. `api.pdfs` - references workers.pdfs.id

All three share the same UUID primary key. Deletion must remove all three
in reverse order (api -> web -> workers).

## API: pdf_storage Domain

Source: `api/app/domains/pdf_storage/`

### Endpoints

| Method | Path                          | Purpose              |
|--------|-------------------------------|----------------------|
| POST   | `/api/v1/pdf-storage/buckets` | Register S3 bucket   |
| POST   | `/api/v1/pdf-storage/pdfs`    | Upload PDF to bucket |

### Create Bucket Flow

Source: `api/app/domains/pdf_storage/service.py:create_bucket`

1. Insert row into `public.aws_buckets` (DB-first)
2. If duplicate name: `asyncpg.UniqueViolationError` -> HTTP 409
3. Create S3 bucket using per-bucket credentials via `boto3.client("s3", ...)`
4. If `BucketAlreadyOwnedByYou`: verify access with `head_bucket`, continue
5. If S3 fails: rollback DB row via `repository.delete_bucket`, raise HTTP 502

Request schema (`schemas.py:CreateBucketRequest`):
- `endpoint_url` has SSRF validation: only localhost, 127.0.0.1, or *.amazonaws.com

### Upload PDF Flow

Source: `api/app/domains/pdf_storage/service.py:upload_pdf`

1. Fetch bucket credentials via `fetch_bucket_by_id` from `shared/repository.py`
2. Sanitize filename (strip path separators, control chars)
3. Build S3 key: `{project_id}/{uuid4()}/{safe_name}`
4. Insert DB rows into all 3 schemas (DB-first) via `repository.insert_pdf`
5. Upload to S3 with `ContentType="application/pdf"`
6. If S3 fails: rollback all DB rows via `repository.delete_pdf`, raise HTTP 502

Router enforces 50 MB max file size (reads bytes, checks length).

Multipart form fields: `file` (UploadFile), `project_id` (UUID), `bucket_id` (UUID).

## API: PDF Fetching (Other Domains)

### pdf_utils domain

Source: `api/app/domains/pdf_utils/repository.py:fetch_pdf`

Joins `workers.pdfs` with `public.aws_buckets` to get filepath + bucket credentials
for a given pdf_id. Used by text extraction services to download PDF bytes.

### llm_ner domain

Source: `api/app/domains/llm_ner/repository.py:fetch_pdf_text`

Queries `workers.pdfs` for `full_text` by pdf_id AND project_id (prevents
cross-project access).

## Workers: S3 Infrastructure

Source: `workers/app/shared/infrastructure/s3.py`

### `make_s3_client(access_key_id, secret_access_key, region, endpoint_url)`

Creates a `boto3.client("s3")` from per-bucket credentials. Used by both
download and upload functions.

### `download_pdf_bytes(conn, pdf_id) -> (bytes, filepath)`

1. Calls `fetch_pdf_bucket_info` to JOIN workers.pdfs + aws_buckets
2. Creates per-bucket S3 client
3. Downloads via `s3.get_object` in a thread (`anyio.to_thread.run_sync`)
4. Raises `LookupError` if pdf_id not found

### `upload_pdf_bytes(conn, pdf_id, data)`

Same pattern: fetch bucket info, create client, `s3.put_object` in thread.

### Workers repository

Source: `workers/app/shared/infrastructure/repository.py:fetch_pdf_bucket_info`

```sql
SELECT w.filepath, ab.name AS bucket_name, ab.region,
       ab.access_key_id, ab.secret_access_key, ab.endpoint_url
FROM workers.pdfs w
JOIN public.aws_buckets ab ON ab.id = w.bucket_id
WHERE w.id = $1
```

## Common Mistakes

### CRITICAL: Using global S3 client or AWS env vars

Wrong:
```python
s3 = app.state.s3  # No global client exists
s3 = boto3.client("s3")  # No global AWS credentials
```

Correct:
```python
# Always build client from per-bucket credentials
bucket = await fetch_bucket_by_id(conn, bucket_id)
s3 = boto3.client("s3",
    aws_access_key_id=bucket["access_key_id"],
    aws_secret_access_key=bucket["secret_access_key"],
    region_name=bucket["region"],
    **({"endpoint_url": bucket["endpoint_url"]} if bucket["endpoint_url"] else {}),
)
```

Global `app.state.s3` was removed. AWS_* settings were removed from config.py.

### CRITICAL: Inserting PDF into only one schema

Wrong:
```python
await conn.execute("INSERT INTO workers.pdfs ...")  # Missing web + api rows
```

Correct:
```python
pdf_id = await conn.fetchval("INSERT INTO workers.pdfs ... RETURNING id", ...)
await conn.execute("INSERT INTO web.pdfs (id) VALUES ($1)", pdf_id)
await conn.execute("INSERT INTO api.pdfs (id) VALUES ($1)", pdf_id)
```

All three schema rows must exist. Deletion order: api -> web -> workers.

### HIGH: S3 before DB (wrong ordering)

Wrong:
```python
s3.put_object(...)      # S3 first
await insert_pdf(...)   # DB second — if this fails, orphaned S3 object
```

Correct:
```python
pdf_id = await insert_pdf(...)   # DB first
try:
    await anyio.to_thread.run_sync(lambda: s3.put_object(...))
except ClientError:
    await delete_pdf(conn, pdf_id)  # Rollback DB on S3 failure
    raise
```

DB-first with S3 rollback. Orphaned DB rows are cheaper to clean up than
orphaned S3 objects.

### HIGH: Calling boto3 directly in async context

Wrong:
```python
async def upload(conn, ...):
    s3.put_object(...)  # Blocks the event loop
```

Correct:
```python
async def upload(conn, ...):
    def _upload():
        s3.put_object(...)
    await anyio.to_thread.run_sync(_upload)
```

boto3 is synchronous. Always wrap in `anyio.to_thread.run_sync`.

### MEDIUM: Missing project_id filter on PDF queries

Wrong:
```python
"SELECT full_text FROM workers.pdfs WHERE id = $1"  # Any project can read any PDF
```

Correct:
```python
"SELECT full_text FROM workers.pdfs WHERE id = $1 AND project_id = $2"
```

Prevents cross-project PDF access. See `llm_ner/repository.py:fetch_pdf_text`.
