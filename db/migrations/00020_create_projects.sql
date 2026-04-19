-- migrate:up
CREATE TABLE web.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES web.users(id) ON DELETE SET NULL,
  team_id TEXT REFERENCES web.teams(id) ON DELETE SET NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  bucket_id UUID,
  color_presets TEXT[], -- list of hex color code strings
  orientation TEXT NOT NULL DEFAULT 'any' CHECK (orientation IN ('any', 'portrait', 'landscape')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT project_owner CHECK (owner_id IS NOT NULL OR team_id IS NOT NULL)
);

CREATE TRIGGER projects_updated_at
BEFORE UPDATE ON web.projects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER projects_updated_at ON web.projects;
DROP TABLE web.projects;
