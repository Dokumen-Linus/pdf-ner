-- migrate:up
CREATE TABLE annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- created by consumer
  pdf_id UUID NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
  subtype TEXT NOT NULL CHECK (subtype IN ('highlight', 'underline', 'squiggly', 'strikeout')),
  rect JSONB NOT NULL,
  segment_rects JSONB NOT NULL,
  page_index INTEGER NOT NULL,
  color TEXT,
  opacity REAL,
  contents TEXT,
  custom_entity_type TEXT,
  author TEXT,
  created TIMESTAMP,
  modified TIMESTAMP,
  blend_mode TEXT CHECK (blend_mode IN ('Normal', 'Multiply', 'Screen', 'Overlay', 'Darken', 'Lighten', 'ColorDodge', 'ColorBurn', 'HardLight', 'SoftLight', 'Difference', 'Exclusion', 'Hue', 'Saturation', 'Color', 'Luminosity')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- migrate:down
DROP TABLE annotations;
