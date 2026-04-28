-- migrate:up
CREATE TABLE web.organizations (
  id TEXT PRIMARY KEY REFERENCES auth.organization(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'base',
  plan_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  stripe_subscription_status TEXT,
  stripe_current_period_start TIMESTAMPTZ,
  stripe_current_period_end TIMESTAMPTZ,
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
