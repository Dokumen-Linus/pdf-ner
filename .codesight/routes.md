# Routes

- `POST` `/api/v1/customer` params() → in: CreateCustomerRequest, out: None [db, payment]
- `GET` `/api/v1/usage` params() → in: UUI, out: None [db, payment]
- `POST` `/api/v1/subscription` params() → in: CreateCustomerRequest, out: None [db, payment]
- `DELETE` `/api/v1/subscription` params() → in: CancelSubscriptionRequest, out: None [db, payment]
- `POST` `/api/v1/report-to-stripe` params() → in: CreateCustomerRequest, out: None [db, payment]
- `POST` `/api/v1/extract` params() → in: ExtractEntitiesRequest [cache]
- `POST` `/api/v1/optimize-prompt` params() → in: ExtractEntitiesRequest [cache]
- `GET` `/api/v1/optimize-prompt/{task_id}/status` params(task_id) [cache]
- `POST` `/api/v1/buckets` params() → in: CreateBucketRequest [upload]
- `POST` `/api/v1/pdfs` params() → in: CreateBucketRequest [upload] ✓
- `POST` `/api/v1/highlight` params() → in: HighlightRequest
