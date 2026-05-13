-- migrate:up
CREATE TABLE core.pdfs (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,

  filepath TEXT NOT NULL, -- path within the s3 bucket from web.projects.bucket_id
  has_labels BOOLEAN NOT NULL DEFAULT false, -- whether the entity type values are labeled in core.entity_values

  -- source of pdf
  source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'listener', 'watcher')),
  source_id UUID REFERENCES core.sources (id) ON DELETE SET NULL,
  uploaded_by_user_id TEXT REFERENCES web.users (id) ON DELETE SET NULL,
  ner_workflow_id UUID REFERENCES workers.ner_workflows (id) ON DELETE SET NULL,
  listener_id UUID REFERENCES workers.listeners (id) ON DELETE SET NULL,
  watcher_id UUID REFERENCES workers.watchers (id) ON DELETE SET NULL,
  watcher_run_id UUID REFERENCES workers.watcher_runs (id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workers.pdf_txts (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_id UUID NOT NULL REFERENCES core.pdfs (id) ON DELETE CASCADE,
  extract_method TEXT NOT NULL REFERENCES public.extract_methods (id) ON DELETE CASCADE,

  created_by_domain TEXT NOT NULL CHECK (created_by_domain IN ('api_pdf_utils', 'ner_workflows', 'ocr_evaluation', 'context_eng', 'model_eval', 'ner_run', 'text_extract')),
  -- ner_run is for one-off runs. will add more values, for example when an api domain is made to add text selection layers to pdfs going into labeling

  txt TEXT NOT NULL,
  text_by_page JSONB,
  text_by_bookmarks JSONB,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER pdfs_updated_at
BEFORE UPDATE ON core.pdfs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER pdf_txts_updated_at
BEFORE UPDATE ON workers.pdf_txts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER pdf_txts_updated_at ON workers.pdf_txts;
DROP TRIGGER pdfs_updated_at ON core.pdfs;
DROP TABLE workers.pdf_txts;
DROP TABLE core.pdfs;
