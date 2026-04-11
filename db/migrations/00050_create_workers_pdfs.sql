-- migrate:up
CREATE TABLE workers.pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT,
  bucket_id UUID NOT NULL REFERENCES api.aws_buckets (id),
  filepath  TEXT NOT NULL,

  -- info from web sent to api via request
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,

  -- info from extract_text
  full_text TEXT,
  extract_method TEXT CHECK (extract_method IN ('pdfium', 'tesseract', 'olm', 'deepseek')),
  text_by_page JSONB,
  text_by_bookmarks JSONB,

  -- info from predict_entities
  predicted_entities JSONB,
  model_type TEXT CHECK (model_type IN ('SLM', 'LLM')),
  model TEXT,
  prompt_id UUID REFERENCES api.prompts (id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER pdfs_updated_at
BEFORE UPDATE ON workers.pdfs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER pdfs_updated_at ON workers.pdfs;
DROP TABLE workers.pdfs;