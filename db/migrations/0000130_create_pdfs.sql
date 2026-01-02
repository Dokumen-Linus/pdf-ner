-- migrate:up
CREATE TABLE app.pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES app.projects (id) ON DELETE CASCADE,
  "filename" TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
-- migrate:down
DROP TABLE app.pdfs;
