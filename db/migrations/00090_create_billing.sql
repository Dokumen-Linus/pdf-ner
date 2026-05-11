-- migrate:up
CREATE TABLE workers.llm_usage (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES web.projects(id) ON DELETE CASCADE,
    actor_user_id TEXT REFERENCES web.users(id) ON DELETE SET NULL,
    model_id TEXT NOT NULL REFERENCES public.chat_models (id),
    source TEXT NOT NULL CHECK (source IN ('api', 'worker')),
    task_name TEXT,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    input_cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0,
    output_cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0,
    cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workers.billing_charge_attempts (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_type TEXT NOT NULL CHECK (account_type IN ('individual', 'organization')),
    user_id TEXT REFERENCES web.users(id),
    organization_id TEXT REFERENCES web.organizations(id),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    base_amount_cents INTEGER NOT NULL DEFAULT 0,
    usage_amount_cents INTEGER NOT NULL DEFAULT 0,
    total_amount_cents INTEGER NOT NULL DEFAULT 0,
    usage_cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0,
    llm_usage_count INTEGER NOT NULL DEFAULT 0,
    stripe_customer_id TEXT NOT NULL,
    stripe_payment_method_id TEXT NOT NULL,
    stripe_payment_intent_id TEXT UNIQUE,
    idempotency_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
    error_message TEXT,
    retry_after TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    charged_at TIMESTAMPTZ,
    CONSTRAINT billing_charge_attempts_account CHECK (
        (account_type = 'individual' AND user_id IS NOT NULL AND organization_id IS NULL)
        OR (account_type = 'organization' AND user_id IS NULL AND organization_id IS NOT NULL)
    )
);

CREATE INDEX llm_usage_project_id_idx ON workers.llm_usage(project_id);
CREATE INDEX llm_usage_actor_user_id_idx ON workers.llm_usage(actor_user_id);
CREATE INDEX llm_usage_created_at_idx ON workers.llm_usage(created_at);
CREATE INDEX billing_charge_attempts_user_id_idx ON workers.billing_charge_attempts(user_id);
CREATE INDEX billing_charge_attempts_organization_id_idx ON workers.billing_charge_attempts(organization_id);
CREATE INDEX billing_charge_attempts_status_idx ON workers.billing_charge_attempts(status);
CREATE INDEX billing_charge_attempts_retry_after_idx ON workers.billing_charge_attempts(retry_after) WHERE retry_after IS NOT NULL;

-- api_user only has SELECT on workers by default; grant INSERT for usage recording
GRANT INSERT ON workers.llm_usage TO api_user;

-- migrate:down
DROP TABLE IF EXISTS workers.billing_charge_attempts;
DROP TABLE IF EXISTS workers.llm_usage;
