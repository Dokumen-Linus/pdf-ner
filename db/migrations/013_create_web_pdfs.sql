-- migrate:up
CREATE TABLE web.pdfs (
  "id" UUID PRIMARY KEY REFERENCES core.pdfs (id) ON DELETE CASCADE,

  -- ensure only one user can edit a PDF at a time
  locked_by TEXT REFERENCES web.users (id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_web_pdfs_locked_at
  ON web.pdfs (locked_at)
  WHERE locked_by IS NOT NULL;

-- migrate:down
DROP INDEX IF EXISTS web.idx_web_pdfs_locked_at;
DROP TABLE web.pdfs;
