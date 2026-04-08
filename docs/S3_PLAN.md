# Plan: S3 Bucket Table + PDF Loading from S3

## Context

`workers.pdfs.location TEXT` currently stores an S3 path as a bare string. There is no structured way to resolve bucket credentials — the API currently gets the bucket name from `web.projects.bucket TEXT` and uses global env-var credentials. The goal is to introduce `public.aws_buckets` as a first-class table holding per-bucket S3 credentials, wire `workers.pdfs` to it, and build end-to-end S3 loading in both workers and API. A new `pdf_storage` API domain will let the web layer create buckets and upload PDFs.

---

## Critical Files

| File | Status |
|------|--------|
| `db/migrations/00049_create_aws_buckets.sql` | NEW |
| `db/migrations/00050_create_workers_pdfs.sql` | MODIFY |
| `workers/app/shared/infrastructure/s3.py` | NEW |
| `workers/app/core/config.py` | MODIFY (add AWS keys) |
| `workers/app/domains/context_engineering/infrastructure/repositories.py` | MODIFY |
| `workers/app/domains/context_engineering/application/workflows.py` | MODIFY |
| `workers/tests/infrastructure/test_s3.py` | NEW |
| `workers/tests/infrastructure/test_repositories.py` | MODIFY |
| `workers/tests/application/test_workflows.py` | MODIFY |
| `api/app/domains/pdf_utils/repository.py` | MODIFY |
| `api/app/domains/pdf_utils/service.py` | MODIFY |
| `api/app/domains/shared/repository.py` | MODIFY |
| `api/app/domains/llm_ner/repository.py` | MODIFY |
| `api/app/domains/llm_ner/schemas.py` | MODIFY |
| `api/app/domains/llm_ner/service.py` | MODIFY |
| `api/tests/test_llm_ner.py` | MODIFY |
| `api/tests/test_service.py` | MODIFY |
| `api/app/domains/pdf_storage/` (5 new files) | NEW |
| `api/tests/test_pdf_storage.py` | NEW |
| `api/app/api.py` | MODIFY |

---

## Phase 1 — Database Migrations

**Files touched: 2**

### 1a. `00049_create_aws_buckets.sql` (NEW)

```sql
-- migrate:up
CREATE TABLE public.aws_buckets (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT    NOT NULL UNIQUE,
  region        TEXT    NOT NULL DEFAULT 'us-east-1',
  access_key_id TEXT    NOT NULL,
  secret_access_key TEXT NOT NULL,
  endpoint_url  TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT           ON public.aws_buckets TO api_user;
GRANT INSERT, UPDATE   ON public.aws_buckets TO api_user;
GRANT SELECT           ON public.aws_buckets TO worker_user;

-- migrate:down
DROP TABLE public.aws_buckets;
```

Stores per-bucket credentials so each bucket can be owned/accessed independently (multi-tenant design).

### 1b. Modify `00050_create_workers_pdfs.sql`

Replace:
```sql
location TEXT NOT NULL,
```
With:
```sql
bucket_id UUID NOT NULL REFERENCES public.aws_buckets (id),
filepath  TEXT NOT NULL,
```

**Reset DB after**: `dbmate down && dbmate up`

---

## Phase 2 — Workers + API in Parallel

Execute Phase 2a and 2b as parallel sub-agents after Phase 1 approval.

---

### Phase 2a — Workers: Shared S3 Infra + Context Engineering

**Files touched: 5** | **Agent A**

#### NEW `workers/app/shared/infrastructure/s3.py`

```python
def make_s3_client(access_key_id: str, secret_access_key: str, region: str, endpoint_url: str | None):
    """Create a boto3 S3 client from bucket credentials."""

async def download_pdf_bytes(conn, pdf_id: UUID) -> tuple[bytes, str]:
    """
    Resolve bucket credentials for pdf_id from DB.
    Query: SELECT w.filepath, ab.name, ab.region, ab.access_key_id, ab.secret_access_key, ab.endpoint_url
           FROM workers.pdfs w JOIN public.aws_buckets ab ON ab.id = w.bucket_id
           WHERE w.id = $1
    Build boto3 client, download, return (bytes, filepath).
    Uses anyio.to_thread.run_sync for sync boto3 call.
    """

async def upload_pdf_bytes(conn, pdf_id: UUID, data: bytes) -> None:
    """Download bucket credentials for pdf_id and upload bytes back."""
```

Workers config (`workers/app/core/config.py`) does **not** need global AWS keys — credentials are stored per-bucket in the DB and resolved at runtime.

#### MODIFY `workers/app/domains/context_engineering/infrastructure/repositories.py`

Update `fetch_labeled_pdfs()` — add `bucket_id, filepath` to the SELECT on `workers.pdfs` so the workflow can call `download_pdf_bytes()` if `full_text` is NULL. Return `bucket_id: UUID | None` and `filepath: str | None` on `LabeledPdf`.

#### MODIFY `workers/app/domains/context_engineering/application/workflows.py`

In `prompt_optimization_workflow`:
- After `fetch_labeled_pdfs()`, for any PDF where `full_text is None`, call `download_pdf_bytes(conn, pdf.pdf_id)`.
- Log a warning and skip the PDF if bytes cannot be resolved (no bucket or network error). Text extraction from raw bytes is out of scope — emit a structured log for observability.

#### Tests

- NEW `workers/tests/infrastructure/test_s3.py`: test `make_s3_client`, mock boto3 to test `download_pdf_bytes` (happy path, PDF not found, S3 error).
- MODIFY `workers/tests/infrastructure/test_repositories.py`: add mock records with `bucket_id + filepath` columns; assert `LabeledPdf.bucket_id` is populated.
- MODIFY `workers/tests/application/test_workflows.py`: add cases for PDFs with `full_text=None` (S3 download called), all PDFs with full_text (S3 not called).

---

### Phase 2b — API: pdf_utils + llm_ner + Shared Repository

**Files touched: 8** | **Agent B**

#### MODIFY `api/app/domains/shared/repository.py`

Add:
```python
async def fetch_bucket_by_id(conn, bucket_id: UUID) -> asyncpg.Record | None:
    """SELECT id, name, region, access_key_id, secret_access_key, endpoint_url
       FROM public.aws_buckets WHERE id = $1"""
```

#### MODIFY `api/app/domains/pdf_utils/repository.py`

Replace current `fetch_pdf()` query (which JOINs `web.projects` for `p.bucket`) with:
```sql
SELECT w.filepath, w.name, w.project_id,
       ab.name AS bucket_name, ab.region, ab.access_key_id,
       ab.secret_access_key, ab.endpoint_url
FROM workers.pdfs w
JOIN public.aws_buckets ab ON ab.id = w.bucket_id
WHERE w.id = $1
```
Return `bucket_name, region, access_key_id, secret_access_key, endpoint_url` (no longer uses `web.projects.bucket`).

#### MODIFY `api/app/domains/pdf_utils/service.py`

`highlight()` function: after `fetch_pdf()`, build a per-bucket boto3 S3 client using returned credentials (instead of the global `s3_client` from `app.state.s3`):
```python
s3 = boto3.client("s3",
    aws_access_key_id=pdf["access_key_id"],
    aws_secret_access_key=pdf["secret_access_key"],
    region_name=pdf["region"],
    **({"endpoint_url": pdf["endpoint_url"]} if pdf["endpoint_url"] else {})
)
```
Use `pdf["filepath"]` in place of `pdf["location"]`.

The global `app.state.s3` / `get_s3_client` dependency can be removed from the pdf_utils router — it's no longer needed.

#### MODIFY `api/app/domains/llm_ner/repository.py`

Add:
```python
async def fetch_pdf_text(conn, pdf_id: UUID) -> str | None:
    """SELECT full_text FROM workers.pdfs WHERE id = $1"""
```

#### MODIFY `api/app/domains/llm_ner/schemas.py`

Add optional field to `ExtractEntitiesRequest`:
```python
pdf_id: UUID | None = None
```
Validation: at least one of `document_text` (non-empty) or `pdf_id` must be provided.

#### MODIFY `api/app/domains/llm_ner/service.py`

In `extract_entities()`: if `request.document_text` is empty and `request.pdf_id` is set, call `fetch_pdf_text(conn, request.pdf_id)`. Raise `HTTPException(404)` if text not found; raise `HTTPException(422)` if text is None/empty.

#### Tests

- MODIFY `api/tests/test_service.py` (pdf_utils): update `fetch_pdf` mock to return `filepath + bucket credentials` columns (remove `location` and `bucket` from mock).
- MODIFY `api/tests/test_llm_ner.py`: add test cases for `pdf_id`-based extraction (PDF found, PDF missing, PDF has no text).

---

## Phase 3 — New API Domain: `pdf_storage`

**Files touched: 6** | After Phase 2 approval.

### NEW `api/app/domains/pdf_storage/schemas.py`

```python
class CreateBucketRequest(BaseModel):
    name: str          # desired S3 bucket name
    region: str = "us-east-1"
    access_key_id: str
    secret_access_key: str
    endpoint_url: str | None = None

class UploadPdfRequest(BaseModel):
    project_id: UUID
    bucket_id: UUID
    filename: str = Field(min_length=1)
    # PDF bytes come as multipart/form-data UploadFile, not in this schema
```

### NEW `api/app/domains/pdf_storage/repository.py`

```python
async def insert_bucket(conn, name, region, access_key_id, secret_access_key, endpoint_url) -> UUID:
    """INSERT INTO public.aws_buckets ... RETURNING id"""

async def insert_pdf(conn, project_id, bucket_id, filepath, name) -> UUID:
    """INSERT INTO workers.pdfs (project_id, bucket_id, filepath, name) ... RETURNING id
       Also INSERT INTO web.pdfs (id) and api.pdfs (id) for the cross-schema records."""
```

### NEW `api/app/domains/pdf_storage/service.py`

```python
async def create_bucket(conn, request: CreateBucketRequest) -> dict:
    """
    1. Build boto3 client from request credentials.
    2. Call s3.create_bucket() (or s3.head_bucket() to verify access if bucket exists).
    3. INSERT into public.aws_buckets via repository.
    4. Return {"bucket_id": str, "name": str}
    """

async def upload_pdf(conn, bucket_id: UUID, project_id: UUID, filename: str, file_bytes: bytes) -> dict:
    """
    1. Fetch bucket credentials via shared repository.fetch_bucket_by_id().
    2. Build boto3 client.
    3. Generate filepath = f"{project_id}/{uuid4()}/{filename}".
    4. Upload bytes to S3.
    5. INSERT into workers.pdfs + web.pdfs + api.pdfs via repository.insert_pdf().
    6. Return {"pdf_id": str, "filepath": str, "bucket_name": str}
    """
```

### NEW `api/app/domains/pdf_storage/router.py`

```python
router = APIRouter(prefix="/pdf-storage", tags=["pdf_storage"])

@router.post("/buckets")  # body: CreateBucketRequest
@router.post("/pdfs")     # multipart: file (UploadFile) + form fields project_id, bucket_id, filename
```
Both use `get_conn`. No `s3_client` dependency — credentials come from request or DB.

### UPDATE `api/app/api.py`

Include `pdf_storage_router`.

### NEW `api/tests/test_pdf_storage.py`

- `TestCreateBucket`: happy path (boto3 mocked), bucket name conflict (S3 error → 502), DB insert failure
- `TestUploadPdf`: happy path, bucket not found (404), S3 upload failure (502), multipart validation

---

## Verification

```bash
# Reset DB (required after modifying 00050)
cd db && dbmate down && dbmate up

# Workers tests
cd workers && pytest tests/ -v

# API tests
cd api && pytest tests/ -v

# Smoke test (with LocalStack or real S3):
# 1. POST /api/v1/pdf-storage/buckets  → get bucket_id
# 2. POST /api/v1/pdf-storage/pdfs     → get pdf_id
# 3. POST /api/v1/pdf-utils/highlight  → uses per-bucket credentials
# 4. POST /api/v1/llm-ner/extract with pdf_id → uses workers.pdfs.full_text
```

---

## Key Decisions

1. **Per-bucket credentials in DB**: Each row in `public.aws_buckets` holds its own `access_key_id + secret_access_key`. The global `app.state.s3` in api lifespan is retained for other potential uses but pdf_utils and pdf_storage build per-bucket clients dynamically.
2. **Workers config**: No global AWS keys added to `workers/app/core/config.py` — workers resolve credentials from the DB at task time.
3. **llm_ner change**: Adding `pdf_id` support is the meaningful change; the domain doesn't use `location` directly so no migration-driven change is needed.
4. **Text extraction**: context_engineering downloads PDF bytes from S3 when `full_text` is None but does not extract text (no pdfium in workers). A structured log is emitted; the PDF is skipped.
5. **Workers S3 path**: `workers/app/shared/infrastructure/s3.py` (existing `workers/app/shared/infrastructure/` directory, not a new `domains/shared/` path).
