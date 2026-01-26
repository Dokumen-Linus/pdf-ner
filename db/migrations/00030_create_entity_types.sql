-- migrate:up
CREATE TABLE web.entity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  page1_definition TEXT,
  page1_examples TEXT[],
  page1_datatype TEXT,
  "unique" BOOLEAN NOT NULL DEFAULT TRUE,
  "required" BOOLEAN NOT NULL DEFAULT TRUE,
  subtype TEXT CHECK (
    subtype IN ('highlight', 'underline', 'squiggly', 'strikeout')
  ),
  color TEXT CHECK (color ~ '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'),
  opacity REAL CHECK (
    opacity >= 0
    AND opacity <= 1
  ),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER entity_types_updated_at
BEFORE UPDATE ON web.entity_types
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER entity_types_updated_at;
DROP TABLE web.entity_types;