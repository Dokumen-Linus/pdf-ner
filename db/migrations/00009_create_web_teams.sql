-- migrate:up
CREATE TABLE web.teams (
  id TEXT PRIMARY KEY REFERENCES auth.team(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER teams_updated_at
BEFORE UPDATE ON web.teams
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER teams_updated_at ON web.teams;
DROP TABLE web.teams;
