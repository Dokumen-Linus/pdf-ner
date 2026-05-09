-- migrate:up
CREATE TABLE api.aws_buckets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  region            TEXT NOT NULL DEFAULT 'us-east-1',
  endpoint_url      TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- migrate:down
DROP TABLE api.aws_buckets;
