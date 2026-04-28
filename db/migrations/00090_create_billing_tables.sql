-- migrate:up
CREATE TABLE workers.llm_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES web.projects(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES web.users(id) ON DELETE SET NULL,
    billing_user_id UUID REFERENCES web.users(id),
    billing_organization_id TEXT REFERENCES web.organizations(id),
    model_id TEXT NOT NULL REFERENCES public.models(id),
    source TEXT NOT NULL CHECK (source IN ('api', 'worker')),
    task_name TEXT,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    input_cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0,
    output_cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0,
    cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0,
    report_batch_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT llm_usage_billing_target CHECK (
        (billing_user_id IS NOT NULL AND billing_organization_id IS NULL)
        OR (billing_user_id IS NULL AND billing_organization_id IS NOT NULL)
    )
);

CREATE TABLE workers.llm_usage_report_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_user_id UUID REFERENCES web.users(id),
    billing_organization_id TEXT REFERENCES web.organizations(id),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    usage_count INTEGER NOT NULL DEFAULT 0,
    input_tokens BIGINT NOT NULL DEFAULT 0,
    output_tokens BIGINT NOT NULL DEFAULT 0,
    cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0,
    stripe_meter_event_identifier TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reported', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reported_at TIMESTAMPTZ,
    CONSTRAINT llm_usage_report_batches_billing_target CHECK (
        (billing_user_id IS NOT NULL AND billing_organization_id IS NULL)
        OR (billing_user_id IS NULL AND billing_organization_id IS NOT NULL)
    )
);

ALTER TABLE workers.llm_usage
    ADD CONSTRAINT llm_usage_report_batch_id_fkey
    FOREIGN KEY (report_batch_id) REFERENCES workers.llm_usage_report_batches(id) ON DELETE SET NULL;

CREATE INDEX llm_usage_project_id_idx ON workers.llm_usage(project_id);
CREATE INDEX llm_usage_actor_user_id_idx ON workers.llm_usage(actor_user_id);
CREATE INDEX llm_usage_billing_user_id_idx ON workers.llm_usage(billing_user_id);
CREATE INDEX llm_usage_billing_organization_id_idx ON workers.llm_usage(billing_organization_id);
CREATE INDEX llm_usage_created_at_idx ON workers.llm_usage(created_at);
CREATE INDEX llm_usage_unreported_idx ON workers.llm_usage(created_at) WHERE report_batch_id IS NULL;
CREATE INDEX llm_usage_report_batches_status_idx ON workers.llm_usage_report_batches(status);

-- api_user only has SELECT on workers by default; grant INSERT for usage recording
GRANT INSERT ON workers.llm_usage TO api_user;

-- migrate:down
DROP TABLE IF EXISTS workers.llm_usage;
DROP TABLE IF EXISTS workers.llm_usage_report_batches;
