-- migrate:up
CREATE TABLE web.pdfs (
  id UUID PRIMARY KEY,
  
  -- any info about pdfs that web writes
  annotated BOOLEAN NOT NULL DEFAULT false,
  labeled_entities JSONB,
  uploaded_by UUID REFERENCES web.users (id) ON DELETE SET NULL,
  first_viewed_at TIMESTAMPTZ DEFAULT now(),

  -- ensure only one user can edit a PDF at a time
  locked_by UUID REFERENCES web.users (id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ
);

CREATE INDEX idx_web_pdfs_locked_at
  ON web.pdfs (locked_at)
  WHERE locked_by IS NOT NULL;

-- migrate:down
DROP INDEX IF EXISTS web.idx_web_pdfs_locked_at;
DROP TABLE web.pdfs;
