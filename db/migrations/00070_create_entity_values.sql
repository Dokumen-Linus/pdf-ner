-- migrate:up
CREATE TABLE core.entity_values (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_id UUID NOT NULL REFERENCES core.pdfs (id) ON DELETE CASCADE,
  entity_type_id UUID NOT NULL REFERENCES web.entity_types (id) ON DELETE CASCADE,

  text_value TEXT NOT NULL, -- value of the label or prediction
  
  is_label BOOLEAN NOT NULL, -- true if value was set by user in labeling or checking

  ner_run_id UUID REFERENCES workers.ner_runs (id) ON DELETE CASCADE,

  -- annotation data
  rect JSONB,
  segment_rects JSONB,
  page_index INTEGER,
  contents TEXT,
  author TEXT,
  blend_mode TEXT CHECK (
    blend_mode IN (
      'Normal',
      'Multiply',
      'Screen',
      'Overlay',
      'Darken',
      'Lighten',
      'ColorDodge',
      'ColorBurn',
      'HardLight',
      'SoftLight',
      'Difference',
      'Exclusion',
      'Hue',
      'Saturation',
      'Color',
      'Luminosity'
    )
  ),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER entity_values_updated_at
BEFORE UPDATE ON core.entity_values
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER entity_values_updated_at ON core.entity_values;
DROP TABLE core.entity_values;
