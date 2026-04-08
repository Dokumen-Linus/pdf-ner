-- migrate:up
CREATE TABLE public.aws_buckets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  region            TEXT NOT NULL DEFAULT 'us-east-1',
  access_key_id     TEXT NOT NULL,
  secret_access_key TEXT NOT NULL,
  endpoint_url      TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.aws_buckets TO api_user;
GRANT SELECT                 ON public.aws_buckets TO workers_user;

-- migrate:down
DROP TABLE public.aws_buckets;
