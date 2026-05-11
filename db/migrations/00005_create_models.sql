-- migrate:up
CREATE TABLE public.chat_models (
    "id" TEXT PRIMARY KEY, -- id must be what API accepts as model name param

    display_name TEXT NOT NULL,
    host TEXT NOT NULL CHECK (host IN ('OpenAI', 'Anthropic', 'Google', 'Dokumen')),
    usd_per_1m_input NUMERIC(8, 4) NOT NULL,
    usd_per_1m_output NUMERIC(8, 4) NOT NULL,
    release_date TIMESTAMPTZ,
    available_date TIMESTAMPTZ DEFAULT now(),
    end_available_date TIMESTAMPTZ
);

CREATE TABLE public.ocr_methods (
    "id" TEXT PRIMARY KEY,

    display_name TEXT NOT NULL,
    method_type TEXT NOT NULL CHECK (method_type IN ('engine', 'gpu')),
    usd_per_1m_pages NUMERIC(8, 2),
    usd_per_sec NUMERIC(8, 6),
    release_date TIMESTAMPTZ,
    available_date TIMESTAMPTZ DEFAULT now(),
    end_available_date TIMESTAMPTZ,

    CONSTRAINT has_price CHECK (usd_per_1m_pages IS NOT NULL OR usd_per_sec IS NOT NULL)
);

-- migrate:down
DROP TABLE public.chat_models;
DROP TABLE public.ocr_methods;
