-- migrate:up
CREATE TABLE web.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES web.users (id) ON DELETE CASCADE,
  COLUMN team_id TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  bucket_id UUID REFERENCES api.aws_buckets (id),
  color_presets TEXT[], -- list of hex color code strings
  orientation TEXT NOT NULL DEFAULT 'any' CHECK (orientation IN ('any', 'portrait', 'landscape')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER projects_updated_at
BEFORE UPDATE ON web.projects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER projects_updated_at ON web.projects;
DROP TABLE web.projects;