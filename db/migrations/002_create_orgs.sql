-- migrate:up
CREATE TABLE web.organizations (
  "id" TEXT PRIMARY KEY REFERENCES auth.organization(id) ON DELETE CASCADE,

  -- billing
  billing_started_at TIMESTAMPTZ DEFAULT NOW(),
  next_payment_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 month',
  last_payment_at TIMESTAMPTZ,
  billing_status TEXT NOT NULL DEFAULT 'stripe_info_missing' CHECK (billing_status IN ('stripe_info_missing', 'active', 'past_due')),
  billing_failure_count INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT UNIQUE,
  stripe_payment_method_id TEXT,

  -- user entered
  "description" TEXT,
  default_color_presets TEXT[],

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER organizations_updated_at
BEFORE UPDATE ON web.organizations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER organizations_updated_at ON web.organizations;
DROP TABLE web.organizations;
