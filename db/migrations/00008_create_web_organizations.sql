-- migrate:up
CREATE TABLE web.organizations (
  id TEXT PRIMARY KEY REFERENCES auth.organization(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'base',
  plan_expires_at TIMESTAMPTZ,
  n_users INTEGER NOT NULL DEFAULT 1 CHECK (n_users >= 1),
  billing_started_at TIMESTAMPTZ,
  next_payment_at TIMESTAMPTZ,
  last_payment_at TIMESTAMPTZ,
  billing_status TEXT NOT NULL DEFAULT 'active' CHECK (billing_status IN ('payment_required', 'active', 'past_due', 'disabled')),
  billing_failure_count INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT UNIQUE,
  stripe_payment_method_id TEXT,
  description TEXT,
  website_url TEXT,
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
