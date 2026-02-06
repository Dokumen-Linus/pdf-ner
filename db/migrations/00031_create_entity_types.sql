-- migrate:up
CREATE TABLE web.entity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  standard_entity_type_id BIGINT REFERENCES api.std_entity_types (id) ON DELETE CASCADE,
  
  -- page1 user inputs
  user_definition TEXT,
  user_examples TEXT[],
  user_format_description TEXT,
  datatype TEXT CHECK (datatype IN ('int', 'float', 'alphanumeric', 'alpha')),
  single_word BOOLEAN,
  exact_length INT,
  "unique" BOOLEAN NOT NULL,
  "required" BOOLEAN NOT NULL,

  -- annotation settings
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
DROP TRIGGER entity_types_updated_at ON web.entity_types;
DROP TABLE web.entity_types;