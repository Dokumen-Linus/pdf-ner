-- migrate:up
CREATE TABLE IF NOT EXISTS web.monitoring_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_kind TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  severity TEXT NOT NULL,
  actor_user_id TEXT REFERENCES web.users (id) ON DELETE SET NULL,
  actor_auth_user_id TEXT REFERENCES auth.user (id) ON DELETE SET NULL,
  organization_id TEXT REFERENCES web.organizations (id) ON DELETE SET NULL,
  project_id UUID REFERENCES web.projects (id) ON DELETE SET NULL,
  resource_type TEXT,
  resource_id TEXT,
  request_id TEXT,
  trace_id TEXT,
  route_or_path TEXT,
  method TEXT,
  duration_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_type TEXT,
  error_message TEXT,
  error_stack TEXT,
  raw_error_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT monitoring_events_event_kind_check CHECK (event_kind IN ('db_fn', 'api_fn', 'route')),
  CONSTRAINT monitoring_events_operation_type_check CHECK (operation_type IN ('read', 'mutation')),
  CONSTRAINT monitoring_events_status_check CHECK (status IN ('success', 'failure')),
  CONSTRAINT monitoring_events_severity_check CHECK (severity IN ('info', 'error'))
);

CREATE INDEX IF NOT EXISTS monitoring_events_created_at_idx ON web.monitoring_events (created_at);
CREATE INDEX IF NOT EXISTS monitoring_events_event_name_idx ON web.monitoring_events (event_name);
CREATE INDEX IF NOT EXISTS monitoring_events_status_idx ON web.monitoring_events (status);
CREATE INDEX IF NOT EXISTS monitoring_events_actor_user_id_idx ON web.monitoring_events (actor_user_id);
CREATE INDEX IF NOT EXISTS monitoring_events_project_id_idx ON web.monitoring_events (project_id);
CREATE INDEX IF NOT EXISTS monitoring_events_request_id_idx ON web.monitoring_events (request_id);

-- migrate:down
DROP INDEX IF EXISTS web.monitoring_events_request_id_idx;
DROP INDEX IF EXISTS web.monitoring_events_project_id_idx;
DROP INDEX IF EXISTS web.monitoring_events_actor_user_id_idx;
DROP INDEX IF EXISTS web.monitoring_events_status_idx;
DROP INDEX IF EXISTS web.monitoring_events_event_name_idx;
DROP INDEX IF EXISTS web.monitoring_events_created_at_idx;
DROP TABLE IF EXISTS web.monitoring_events;
