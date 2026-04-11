-- migrate:up
CREATE TABLE workers.llm_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES web.users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES web.projects(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('api', 'worker')),
    task_name TEXT,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0,
    stripe_reported BOOLEAN NOT NULL DEFAULT FALSE,
    stripe_usage_event_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX llm_usage_user_id_idx ON workers.llm_usage(user_id);
CREATE INDEX llm_usage_created_at_idx ON workers.llm_usage(created_at);
CREATE INDEX llm_usage_unreported_idx ON workers.llm_usage(stripe_reported) WHERE NOT stripe_reported;

-- api_user only has SELECT on workers by default; grant INSERT for usage recording
GRANT INSERT ON workers.llm_usage TO api_user;

CREATE TABLE workers.stripe_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES web.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL UNIQUE,
    stripe_subscription_id TEXT,
    stripe_subscription_item_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER stripe_customers_updated_at
    BEFORE UPDATE ON workers.stripe_customers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- api_user and web_user need INSERT/UPDATE for customer + subscription management
GRANT INSERT, UPDATE ON workers.stripe_customers TO api_user;
GRANT INSERT, UPDATE ON workers.stripe_customers TO web_user;

-- migrate:down
DROP TABLE IF EXISTS workers.stripe_customers;
DROP TABLE IF EXISTS workers.llm_usage;
