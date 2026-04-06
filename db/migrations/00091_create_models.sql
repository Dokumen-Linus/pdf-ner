-- migrate:up
CREATE TABLE public.models (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google')),
    usd_per_1m_input NUMERIC(10, 4) NOT NULL,
    usd_per_1m_output NUMERIC(10, 4) NOT NULL,
    release_date TIMESTAMPTZ NOT NULL,
    available_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_available_date TIMESTAMPTZ
);

-- migrate:down
DROP TABLE IF EXISTS public.models;
