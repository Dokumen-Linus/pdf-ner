-- migrate:up
CREATE TABLE workers.chat_model_eval_runs (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,

  -- run sets beta to use in F-score calculation
  beta REAL NOT NULL DEFAULT 1 CHECK (beta >= 0.001),

  -- each run is provided a set of PDFs with is_label = true to create examples from and test on
  labeled_pdfs UUID[] NOT NULL,

  -- each run is provided with a set of models to test
  chat_models TEXT[] NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- each run iteratively tests multiple prompts
CREATE TABLE workers.chat_model_eval_iterations (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_model_eval_run_id UUID NOT NULL REFERENCES workers.chat_model_eval_runs (id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES public.chat_models (id) ON DELETE CASCADE,
  -- will get prompt from web.projects.prompt_id and bucket from web.projects.bucket_id

  accumulated_usd REAL NOT NULL DEFAULT 0 CHECK (accumulated_usd >= 0),
  
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

-- migrate:down
DROP TABLE workers.chat_model_eval_iterations;
DROP TABLE workers.chat_model_eval_runs;
