-- migrate:up
CREATE TABLE web.users (
  "id" TEXT PRIMARY KEY REFERENCES auth.user (id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES auth.organization (id) ON DELETE SET NULL,

  -- user entered
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  employer TEXT,
  job_title TEXT,
  avatar_url TEXT,

  -- RBAC
  "role" TEXT NOT NULL DEFAULT 'individual' CHECK (role IN ('individual', 'admin', 'developer', 'analyst')),

  -- billing (if user is not in an org)
  billing_started_at TIMESTAMPTZ DEFAULT NOW(),
  next_payment_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 month',
  last_payment_at TIMESTAMPTZ,
  billing_status TEXT NOT NULL DEFAULT 'stripe_info_missing' CHECK (billing_status IN ('stripe_info_missing', 'active', 'past_due')),
  billing_failure_count INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT UNIQUE,
  stripe_payment_method_id TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON web.users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER users_updated_at ON web.users;
DROP TABLE web.users;
