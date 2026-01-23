-- migrate:up
CREATE TABLE api.prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
  full_text TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- migrate:down
DROP TABLE web.entity_types;