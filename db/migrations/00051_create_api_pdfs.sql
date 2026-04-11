-- migrate:up
CREATE TABLE api.pdfs (
  id UUID PRIMARY KEY,
  CONSTRAINT pdfs_id_fkey FOREIGN KEY (id) REFERENCES workers.pdfs (id) ON DELETE CASCADE, -- same id as workers.pdfs
  
  -- first two endpoints for kevin
  bookmarks TEXT[],
  original_has_text BOOLEAN
);

-- migrate:down
DROP TABLE api.pdfs;