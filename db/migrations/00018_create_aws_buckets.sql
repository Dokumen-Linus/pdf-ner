-- migrate:up
CREATE TABLE api.aws_buckets (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT REFERENCES web.users (id) ON DELETE SET NULL,
  owner_org_id TEXT REFERENCES web.organizations (id) ON DELETE SET NULL,

  "name" TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL DEFAULT 'us-east-1',
  "endpoint_url" TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- bucket is owned by a user with inidivual role (no org) or by an org
  CONSTRAINT has_owner CHECK (owner_user_id IS NOT NULL OR owner_org_id IS NOT NULL)
);

CREATE TRIGGER aws_buckets_updated_at
BEFORE UPDATE ON api.aws_buckets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER aws_buckets_updated_at ON api.aws_buckets;
DROP TABLE api.aws_buckets;
