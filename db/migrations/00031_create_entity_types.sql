-- migrate:up
CREATE TABLE web.entity_types (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
  standard_entity_type_id BIGINT REFERENCES public.std_entity_types (id) ON DELETE SET NULL,
  
  -- user entered
  "name" TEXT NOT NULL,
  user_definition TEXT,
  user_example_values TEXT[],
  user_format_description TEXT,
  datatype TEXT CHECK (datatype IN ('int', 'float', 'alphanumeric', 'alpha', 'alpha_with_spaces')),
  regex TEXT, -- should be null unless copied from std_entity_types
  exact_length INT,
  "unique" BOOLEAN NOT NULL,
  "required" BOOLEAN NOT NULL,

  -- annotation settings
  subtype TEXT NOT NULL DEFAULT 'highlight' CHECK (
    subtype IN ('highlight', 'underline', 'squiggly', 'strikeout')
  ),
  color TEXT NOT NULL CHECK (color ~ '^#[0-9A-F]{6}$'),
  opacity REAL NOT NULL DEFAULT 0.6 CHECK (opacity >= 0 AND opacity <= 1),

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
