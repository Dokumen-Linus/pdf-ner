-- migrate:up
CREATE TABLE api.templates (
  id BIGINT GENERATED ALWAYS AS IDENTITY (START WITH 1),
  txt TEXT NOT NULL,
  inserts TEXT[] NOT NULL,
  document_at_end BOOLEAN NOT NULL DEFAULT true,
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