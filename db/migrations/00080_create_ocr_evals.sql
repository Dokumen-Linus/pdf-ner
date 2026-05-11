-- migrate:up
CREATE TABLE workers.ocr_evaluation_runs (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  judge_model TEXT NOT NULL REFERENCES public.chat_models (id),
  max_pdfs INT NOT NULL,
  max_pages_per_pdf INT NOT NULL,
  sampled_pdf_count INT NOT NULL DEFAULT 0,
  sampled_page_count INT NOT NULL DEFAULT 0,
  recommendation TEXT CHECK (recommendation IN ('pdfium', 'tesseract', 'olm', 'manual_review')),
  confidence REAL,
  summary JSONB,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0,
  error_type TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE workers.ocr_evaluation_pages (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES workers.ocr_evaluation_runs (id) ON DELETE CASCADE,
  pdf_id UUID NOT NULL REFERENCES core.pdfs (id) ON DELETE CASCADE,
  page_index INT NOT NULL,
  pdfium_excerpt TEXT,
  tesseract_excerpt TEXT,
  olm_excerpt TEXT,
  deterministic_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  judge_result JSONB,
  recommended_method TEXT CHECK (recommended_method IN ('pdfium', 'tesseract', 'olm', 'manual_review')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ocr_evaluation_runs_project_started
  ON workers.ocr_evaluation_runs (project_id, started_at DESC);

CREATE INDEX idx_ocr_evaluation_pages_run
  ON workers.ocr_evaluation_pages (run_id, pdf_id, page_index);

-- migrate:down
DROP TABLE workers.ocr_evaluation_pages;
DROP TABLE workers.ocr_evaluation_runs;
