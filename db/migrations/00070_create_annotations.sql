-- migrate:up
CREATE TABLE web.annotations (
  id UUID PRIMARY KEY, -- set in web app PDFContainer
  pdf_id UUID NOT NULL REFERENCES web.pdfs (id) ON DELETE CASCADE,
  subtype TEXT NOT NULL CHECK (subtype IN ('highlight', 'underline', 'squiggly', 'strikeout')),
  rect JSONB NOT NULL,
  segment_rects JSONB NOT NULL,
  page_index INTEGER NOT NULL,
  color TEXT,
  opacity REAL,
  contents TEXT,
  custom_entity_type TEXT,
  author TEXT,
  created TIMESTAMP, -- set in web app PDFContainer
  modified TIMESTAMP, -- set in web app PDFContainer
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
  )
);

-- migrate:down
DROP TABLE web.annotations;