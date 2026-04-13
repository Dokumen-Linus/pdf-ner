-- migrate:up
CREATE TABLE api.prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
  template_id BIGINT REFERENCES public.templates (id) ON DELETE SET NULL,
  full_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER prompts_updated_at
BEFORE UPDATE ON api.prompts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER prompts_updated_at ON api.prompts;
DROP TABLE api.prompts;
