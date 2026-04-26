-- migrate:up
ALTER TABLE workers.pdfs
ADD COLUMN optimized_prompt_id UUID REFERENCES workers.optimized_prompts (id) ON DELETE SET NULL;

CREATE TABLE workers.source_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
  optimized_prompt_id UUID NOT NULL REFERENCES workers.optimized_prompts (id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  watch_mode TEXT NOT NULL DEFAULT 'polling' CHECK (watch_mode IN ('polling', 'native_listener', 'disabled')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled', 'error')),
  poll_interval_seconds INT NOT NULL DEFAULT 300 CHECK (poll_interval_seconds > 0),
  next_poll_at TIMESTAMPTZ,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workers.document_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_connection_id UUID NOT NULL REFERENCES workers.source_connections (id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
  pdf_id UUID NOT NULL REFERENCES workers.pdfs (id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  external_version TEXT NOT NULL DEFAULT '',
  uri TEXT,
  fingerprint TEXT,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'processing', 'processed', 'failed', 'ignored')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  discovered_at TIMESTAMPTZ DEFAULT now(),
  last_queued_at TIMESTAMPTZ,
  last_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (source_connection_id, external_id, external_version)
);

CREATE TABLE workers.source_sync_states (
  source_connection_id UUID PRIMARY KEY REFERENCES workers.source_connections (id) ON DELETE CASCADE,
  cursor JSONB,
  last_polled_at TIMESTAMPTZ,
  next_poll_at TIMESTAMPTZ,
  failure_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workers.watch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_connection_id UUID NOT NULL REFERENCES workers.source_connections (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  cursor_before JSONB,
  cursor_after JSONB,
  discovered_count INT NOT NULL DEFAULT 0,
  enqueued_count INT NOT NULL DEFAULT 0,
  error_type TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE workers.listener_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_connection_id UUID NOT NULL REFERENCES workers.source_connections (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'renewal_due', 'disabled', 'error')),
  provider_subscription_id TEXT,
  callback_url TEXT,
  secret_ref TEXT,
  expires_at TIMESTAMPTZ,
  renew_after TIMESTAMPTZ,
  provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workers.entity_extraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_source_id UUID NOT NULL REFERENCES workers.document_sources (id) ON DELETE CASCADE,
  pdf_id UUID NOT NULL REFERENCES workers.pdfs (id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
  optimized_prompt_id UUID NOT NULL REFERENCES workers.optimized_prompts (id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  ocr_method TEXT CHECK (ocr_method IN ('tesseract', 'deepseek', 'olm')),
  extract_method TEXT CHECK (extract_method IN ('metadata', 'pdfium', 'tesseract', 'deepseek', 'olm')),
  model TEXT,
  input_tokens INT,
  output_tokens INT,
  extracted JSONB,
  error_type TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX idx_document_sources_pdf_id ON workers.document_sources (pdf_id);
CREATE INDEX idx_document_sources_status ON workers.document_sources (status);
CREATE INDEX idx_watch_runs_connection_started ON workers.watch_runs (source_connection_id, started_at DESC);
CREATE INDEX idx_listener_subscriptions_renew_after ON workers.listener_subscriptions (renew_after) WHERE status = 'active';
CREATE INDEX idx_entity_extraction_runs_document_started ON workers.entity_extraction_runs (document_source_id, started_at DESC);

CREATE TRIGGER source_connections_updated_at
BEFORE UPDATE ON workers.source_connections
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER document_sources_updated_at
BEFORE UPDATE ON workers.document_sources
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER listener_subscriptions_updated_at
BEFORE UPDATE ON workers.listener_subscriptions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER listener_subscriptions_updated_at ON workers.listener_subscriptions;
DROP TRIGGER document_sources_updated_at ON workers.document_sources;
DROP TRIGGER source_connections_updated_at ON workers.source_connections;
DROP TABLE workers.entity_extraction_runs;
DROP TABLE workers.listener_subscriptions;
DROP TABLE workers.watch_runs;
DROP TABLE workers.source_sync_states;
DROP TABLE workers.document_sources;
DROP TABLE workers.source_connections;
ALTER TABLE workers.pdfs DROP COLUMN optimized_prompt_id;
