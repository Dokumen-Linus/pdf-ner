-- migrate:up
ALTER TABLE web.projects ADD COLUMN team_id TEXT;

-- migrate:down
ALTER TABLE web.projects DROP COLUMN team_id;
