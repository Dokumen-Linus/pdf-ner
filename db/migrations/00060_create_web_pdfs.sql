-- migrate:up
CREATE TABLE web.pdfs (
  id UUID PRIMARY KEY,
  CONSTRAINT pdfs_id_fkey FOREIGN KEY (id) REFERENCES workers.pdfs (id) ON DELETE CASCADE, -- same id as workers.pdfs
  
  -- any info about pdfs that web writes
  uploaded_by UUID REFERENCES web.users (id) ON DELETE CASCADE,
  first_viewed_at TIMESTAMPTZ DEFAULT now()
);

-- migrate:down
DROP TABLE web.pdfs;