-- migrate:up
CREATE TABLE api.templates (
  id BIGINT GENERATED ALWAYS AS IDENTITY,
  txt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER templates_updated_at
BEFORE UPDATE ON api.templates
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER templates_updated_at;
DROP TABLE api.templates;