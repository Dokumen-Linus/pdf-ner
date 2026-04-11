# Routes

- `POST` `/customer` params() → in: CreateCustomerRequest, out: None [db, payment]
- `GET` `/usage` params() → in: UUI, out: None [db, payment]
- `POST` `/subscription` params() → in: CreateCustomerRequest, out: None [db, payment]
- `DELETE` `/subscription` params() → in: CancelSubscriptionRequest, out: None [db, payment]
- `POST` `/report-to-stripe` params() → in: CreateCustomerRequest, out: None [db, payment]
- `POST` `/extract` params() → in: ExtractEntitiesRequest
- `POST` `/buckets` params() → in: CreateBucketRequest [upload]
- `POST` `/pdfs` params() → in: CreateBucketRequest [upload]
- `POST` `/highlight` params() → in: HighlightRequest
