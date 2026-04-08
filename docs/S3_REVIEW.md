# Summary

- The current repo mostly follows `S3_PLAN.md`
- The highest-risk issues are a cross-project PDF text access bug in `llm_ner`, an SSRF-capable `endpoint_url`, and multiple partial-failure paths that can leave S3 and the database out of sync (`api/app/domains/llm_ner/repository.py:36-41`, `api/app/domains/llm_ner/service.py:135-141`, `api/app/domains/pdf_storage/schemas.py:6-11`, `api/app/domains/pdf_storage/service.py:17-90`, `api/app/domains/pdf_storage/repository.py:24-40`).

# Plan Compliance

- `llm_ner` does not implement the plan's error split for `pdf_id` lookups. The plan says `404` when the PDF row is missing and `422` when the row exists but `full_text` is null/empty. `fetch_pdf_text()` collapses both "row missing" and "`full_text` is NULL" into `None`, so `extract_entities()` always returns `404` for both cases (`api/app/domains/llm_ner/repository.py:36-41`, `api/app/domains/llm_ner/service.py:136-141`).
- The worker flow only downloads bytes and then skips PDFs without `full_text`, which matches the "text extraction out of scope" decision in the plan (`workers/app/domains/context_engineering/application/workflows.py:45-66`). No issue there.
- `create_bucket()` does not implement the plan's "DB insert failure" handling. After successful S3 bucket creation or verification, any database failure will bubble up without cleanup or a domain-specific response (`api/app/domains/pdf_storage/service.py:44-57`).
- `api/tests/domains/test_pdf_storage.py` does not contain the plan's promised DB-insert-failure coverage for bucket creation or PDF insertion. The tests cover happy path, S3 failures, and validation only (`api/tests/domains/test_pdf_storage.py:59-345`).

# Security

- `endpoint_url` is accepted directly from API input and passed to `boto3.client()` with no allowlist or validation, which gives callers a server-side request capability to arbitrary endpoints (`api/app/domains/pdf_storage/schemas.py:6-11`, `api/app/domains/pdf_storage/service.py:18-25`). This is an SSRF risk if the route is reachable by untrusted clients.
- `llm_ner` can read `workers.pdfs.full_text` for any `pdf_id` without proving that the PDF belongs to `request.project_id`. The code validates the project and entity types for the requested project, then fetches text by bare PDF UUID only (`api/app/domains/llm_ner/repository.py:36-41`, `api/app/domains/llm_ner/service.py:114-141`). That is a cross-project data exposure bug.
- Bucket credentials are stored in plaintext in `public.aws_buckets` (`db/migrations/00049_create_aws_buckets.sql:2-9`). This is plan-compliant, but it is still a material secret-management risk if the database is ever exposed or broadly readable.
- No presigned URL generation exists in the reviewed change set, so there is no expiry policy to evaluate. I verified this by searching `api/` and `workers/` for presign-related code and finding none.
- `create_bucket()` and `upload_pdf()` do not apply any bucket-level public-access controls, object encryption settings, or upload metadata such as `ContentType="application/pdf"`; uploads are plain `put_object(..., Body=file_bytes)` calls (`api/app/domains/pdf_storage/service.py:27-45`, `api/app/domains/pdf_storage/service.py:82-88`). That leaves important S3 security posture to external manual configuration.

# Error Handling

- `upload_pdf()` uploads to S3 before it writes the three database rows. If `insert_pdf()` fails after `put_object()`, the object remains in S3 with no rollback path (`api/app/domains/pdf_storage/service.py:82-90`, `api/app/domains/pdf_storage/repository.py:31-40`).
- `create_bucket()` creates or verifies the bucket before inserting the `aws_buckets` row. If the insert fails, the bucket still exists remotely but is unknown to the application (`api/app/domains/pdf_storage/service.py:27-57`).
- `create_bucket()` treats `BucketAlreadyExists` the same as `BucketAlreadyOwnedByYou` by falling back to `head_bucket()` (`api/app/domains/pdf_storage/service.py:36-40`). That can produce confusing behavior when the name is globally taken by someone else: the final error will depend on `head_bucket()` rather than a clear conflict response.
- `create_bucket()` does not catch uniqueness violations on `public.aws_buckets.name`. If the bucket already exists in S3 and already exists in the table, the API will fall through to an uncaught database exception instead of a stable `409`/`422` response (`db/migrations/00049_create_aws_buckets.sql:4`, `api/app/domains/pdf_storage/service.py:49-57`, `api/app/domains/pdf_storage/repository.py:14-21`).
- `upload_pdf()` reads the entire uploaded file into memory with `await file.read()` and has no size checks (`api/app/domains/pdf_storage/router.py:21-29`). Large uploads can turn into avoidable memory pressure or request-amplification failures.

# Architecture Violations

- The API still keeps a global app-state S3 client in the lifespan layer even though the new S3 work intentionally moved `pdf_utils` and `pdf_storage` to per-bucket clients (`api/app/core/lifespan.py:34-41`). This is not a correctness bug by itself, but it weakens the "credentials resolved per bucket" direction and leaves two S3 access patterns in the service.

# Gaps and Risks

- `upload_pdf()` does not verify that `bucket_id` is authorized for `project_id`; any caller who knows a bucket UUID can attach PDFs from one project into another project's namespace (`api/app/domains/pdf_storage/service.py:60-90`, `api/app/domains/pdf_storage/repository.py:24-40`). [UNVERIFIED] This may or may not violate intended tenancy rules because I did not find a project-to-bucket ownership model in the reviewed files.
- Filenames are inserted into S3 keys without normalization or restrictions beyond whatever the client sends as `file.filename` (`api/app/domains/pdf_storage/router.py:28-29`, `api/app/domains/pdf_storage/service.py:80`). S3 keys allow this, but odd names can create operational problems and inconsistent downstream behavior.
- The worker-side S3 fallback adds observability only via warnings and does not surface structured failure details such as bucket name, key, or S3 error code (`workers/app/domains/context_engineering/application/workflows.py:52-62`). That makes production diagnosis harder when a batch silently skips labeled PDFs.
