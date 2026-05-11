-- migrate:up
CREATE TABLE public.source_providers (
  "id" TEXT PRIMARY KEY,

  "provider" TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('content_collab', 'infra', 'email', 'site', 'api')),
  vendor TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE core.source_connections (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" TEXT NOT NULL REFERENCES public.source_providers (id) ON DELETE CASCADE,

  -- TODO: review
  config JSONB,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE core.sources (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_connection_id UUID NOT NULL REFERENCES core.source_connections (id) ON DELETE CASCADE,

  -- TODO: review
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
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workers.watchers (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_source_id UUID NOT NULL REFERENCES core.sources (id) ON DELETE CASCADE,

  -- TODO: review
  poll_interval_seconds INT NOT NULL DEFAULT 300 CHECK (poll_interval_seconds > 0),
  cursor JSONB,
  last_polled_at TIMESTAMPTZ,
  next_poll_at TIMESTAMPTZ,
  failure_count INT NOT NULL DEFAULT 0,
  last_error TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workers.watcher_runs (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watcher_id UUID NOT NULL REFERENCES workers.watchers (id) ON DELETE CASCADE,

  -- TODO: review
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  cursor_before JSONB,
  cursor_after JSONB,
  discovered_count INT NOT NULL DEFAULT 0,
  enqueued_count INT NOT NULL DEFAULT 0,
  error_type TEXT,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workers.listeners (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_source_id UUID NOT NULL REFERENCES core.sources (id) ON DELETE CASCADE,

  -- TODO: review
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

-- long running tasks to process new docs at source (production pipeline)
CREATE TABLE workers.ner_workflows (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
  -- spawned workers.ner_runs will get prompt from web.projects.prompt_id and bucket from web.projects.bucket_id
  
  watcher_id UUID REFERENCES workers.watchers (id) ON DELETE SET NULL,
  listener_id UUID REFERENCES workers.listeners (id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- run has a watcher or listener
  CONSTRAINT has_pdf_fetcher CHECK (watcher_id IS NOT NULL OR listener_id IS NOT NULL)
);

CREATE TRIGGER source_connections_updated_at
BEFORE UPDATE ON core.source_connections
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER sources_updated_at
BEFORE UPDATE ON core.sources
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER watchers_updated_at
BEFORE UPDATE ON workers.watchers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER listeners_updated_at
BEFORE UPDATE ON workers.listeners
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER ner_workflows_updated_at
BEFORE UPDATE ON workers.ner_workflows
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER ner_workflows_updated_at ON workers.ner_workflows;
DROP TRIGGER listeners_updated_at ON workers.listeners;
DROP TRIGGER watchers_updated_at ON workers.watchers;
DROP TRIGGER sources_updated_at ON core.sources;
DROP TRIGGER source_connections_updated_at ON core.source_connections;
DROP TABLE workers.ner_workflows;
DROP TABLE workers.listeners;
DROP TABLE workers.watcher_runs;
DROP TABLE workers.watchers;
DROP TABLE core.sources;
DROP TABLE core.source_connections;
DROP TABLE public.source_providers;
