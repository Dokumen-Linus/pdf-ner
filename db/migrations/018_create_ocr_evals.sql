-- migrate:up
CREATE TABLE workers.ocr_evaluation_runs (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  judge_model TEXT NOT NULL REFERENCES public.chat_models (id),
  max_pdfs INT NOT NULL,
  max_pages_per_pdf INT NOT NULL,
  extract_method TEXT NOT NULL REFERENCES public.extract_methods (id),
  ocr_only BOOLEAN NOT NULL DEFAULT false,
  sampled_pdf_count INT NOT NULL DEFAULT 0,
  sampled_page_count INT NOT NULL DEFAULT 0,
  recommendation TEXT CHECK (recommendation IN ('pdfium', 'tesseract', 'deepseek-ocr', 'olm-ocr2', 'manual_review')),
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
  "id" BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY (START WITH 1),
  run_id UUID NOT NULL REFERENCES workers.ocr_evaluation_runs (id) ON DELETE CASCADE,
  pdf_id UUID NOT NULL REFERENCES core.pdfs (id) ON DELETE CASCADE,
  page_index INT NOT NULL,
  deterministic_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  judge_result JSONB,
  recommended_method TEXT CHECK (recommended_method IN ('pdfium', 'tesseract', 'deepseek-ocr', 'olm-ocr2', 'manual_review')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workers.ocr_evaluation_pdf_txts (
  "id" BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY (START WITH 1),
  run_id UUID NOT NULL REFERENCES workers.ocr_evaluation_runs (id) ON DELETE CASCADE,
  pdf_id UUID NOT NULL REFERENCES core.pdfs (id) ON DELETE CASCADE,
  extract_method TEXT NOT NULL REFERENCES public.extract_methods (id),
  pdf_txt_id BIGINT NOT NULL REFERENCES workers.pdf_txts (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, pdf_id, extract_method)
);

CREATE INDEX idx_ocr_evaluation_runs_project_started
  ON workers.ocr_evaluation_runs (project_id, started_at DESC);

CREATE INDEX idx_ocr_evaluation_pages_run
  ON workers.ocr_evaluation_pages (run_id, pdf_id, page_index);

CREATE INDEX idx_ocr_evaluation_pdf_txts_run
  ON workers.ocr_evaluation_pdf_txts (run_id, pdf_id);

-- migrate:down
DROP TABLE workers.ocr_evaluation_pdf_txts;
DROP TABLE workers.ocr_evaluation_pages;
DROP TABLE workers.ocr_evaluation_runs;
