-- migrate:up
CREATE TABLE workers.context_engineering_runs (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
  -- will get bucket from web.projects.bucket_id

  -- run sets beta to use in F-score calculation
  beta REAL NOT NULL DEFAULT 1 CHECK (beta >= 0.001),

  -- run is terminated soon after max cost is hit
  max_usd REAL NOT NULL CHECK (max_usd >= 1),
  accumulated_usd REAL NOT NULL DEFAULT 0 CHECK (accumulated_usd >= 0),

  -- tracking best iter. later run can also be terminated by acheiving sufficient accuracy
  best_overall_f REAL CHECK (best_overall_f >= 0 AND best_overall_f <= 1),
  best_prompt_id UUID REFERENCES core.prompts (id) ON DELETE SET NULL,

  stop_reason TEXT,

  -- each run is provided a set of PDFs with is_label = true to create examples from and test on
  labeled_pdfs UUID[] NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- each run iteratively tests multiple prompts
CREATE TABLE workers.context_engineering_iterations (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_eng_run_id UUID NOT NULL REFERENCES workers.context_engineering_runs (id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES core.prompts (id) ON DELETE CASCADE,

  -- some metrics are only calculated at the end for the best iter
  overall_f REAL NOT NULL,
  per_entity_scores JSONB,
  num_example_pdfs INTEGER, -- pdfs with any entity type used as an example
  num_correct_pdfs INTEGER, -- pdfs with all entity type values correct
  num_correct_entity_types INTEGER, -- entity types with correct values for all pdfs
  pdf_accuracy REAL,
  entity_type_metrics JSONB,

  -- each iter executes an ner_run

  created_at TIMESTAMPTZ DEFAULT now()
);

-- each prompt tracks which PDFs + entity type combos are used as examples for accuracy metrics with train-test spilt
CREATE TABLE workers.prompt_examples (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES core.prompts (id) ON DELETE CASCADE,
  pdf_id UUID NOT NULL REFERENCES core.pdfs (id) ON DELETE CASCADE,
  entity_type_id UUID NOT NULL REFERENCES web.entity_types (id) ON DELETE CASCADE,

  -- presence in this table means that the PDF + ET is used as an example

  example_idx INT NOT NULL, -- for this prompt and entity type, what is the index of this pdf in core.prompts.entity_type_example_finds

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER context_engineering_runs_updated_at
BEFORE UPDATE ON workers.context_engineering_runs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER context_engineering_runs_updated_at ON workers.context_engineering_runs;
DROP TABLE workers.prompt_examples;
DROP TABLE workers.context_engineering_iterations;
DROP TABLE workers.context_engineering_runs;
