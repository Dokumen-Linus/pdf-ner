-- migrate:up
CREATE TABLE api.aws_buckets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  region            TEXT NOT NULL DEFAULT 'us-east-1',
  access_key_id     TEXT NOT NULL,
  secret_access_key TEXT NOT NULL,
  endpoint_url      TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- migrate:down
DROP TABLE api.aws_buckets;
