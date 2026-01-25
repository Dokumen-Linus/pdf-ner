-- migrate:up
CREATE TABLE web.pdfs (
  id UUID PRIMARY KEY,
  CONSTRAINT pdfs_id_fkey FOREIGN KEY (id) REFERENCES api.pdfs (id) ON DELETE CASCADE, -- same id as api.pdfs
  
  -- any info about pdfs that web adds and api doesn't need
  first_viewed_at TIMESTAMPTZ DEFAULT now()
);

-- migrate:down
DROP TABLE web.pdfs;