-- migrate:up
CREATE TABLE workers.chat_model_eval_runs (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
  best_model_id TEXT REFERENCES public.chat_models (id) ON DELETE SET NULL,

  -- run sets beta to use in F-score calculation
  beta REAL NOT NULL DEFAULT 1 CHECK (beta >= 0.001),

  accumulated_usd REAL NOT NULL DEFAULT 0 CHECK (accumulated_usd >= 0),
  best_overall_f REAL CHECK (best_overall_f >= 0 AND best_overall_f <= 1),
  best_accuracy_score REAL CHECK (best_accuracy_score >= 0 AND best_accuracy_score <= 1),

  -- each run is provided a set of PDFs with is_label = true to create examples from and test on
  labeled_pdfs UUID[] NOT NULL,

  -- each run is provided with a set of models to test
  chat_models TEXT[] NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- each run iteratively tests multiple prompts
CREATE TABLE workers.chat_model_eval_iterations (
  "id" BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY (START WITH 1),
  chat_model_eval_run_id UUID NOT NULL REFERENCES workers.chat_model_eval_runs (id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES public.chat_models (id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES core.prompts (id) ON DELETE CASCADE,
  -- will get bucket from web.projects.bucket_id

  accumulated_usd REAL NOT NULL DEFAULT 0 CHECK (accumulated_usd >= 0),
  
  -- some metrics are only calculated at the end for the best iter
  overall_f REAL NOT NULL,
  per_entity_scores JSONB,
  num_example_pdfs INTEGER, -- pdfs with any entity type used as an example
  num_correct_pdfs INTEGER, -- pdfs with all entity type values correct
  num_correct_entity_types INTEGER, -- entity types with correct values for all pdfs
  pdf_accuracy REAL,
  entity_type_metrics JSONB,
  incorrectly_predicted_entity_value_ids BIGINT[] NOT NULL DEFAULT ARRAY[]::bigint[],

  -- each iter executes an ner_run

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER chat_model_eval_runs_updated_at
BEFORE UPDATE ON workers.chat_model_eval_runs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER chat_model_eval_runs_updated_at ON workers.chat_model_eval_runs;
DROP TABLE workers.chat_model_eval_iterations;
DROP TABLE workers.chat_model_eval_runs;
