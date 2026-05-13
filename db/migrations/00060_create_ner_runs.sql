-- migrate:up
CREATE TABLE workers.ner_runs (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES core.prompts (id) ON DELETE CASCADE,
  -- bucket_id will be the web.projects.bucket_id

  -- runs may be from a workflow, context_eng_iter, model_eval_iter, or a one-off run
  ner_workflow_id UUID REFERENCES workers.ner_workflows (id) ON DELETE CASCADE,
  context_eng_iter_id BIGINT REFERENCES workers.context_engineering_iterations (id) ON DELETE CASCADE,
  model_eval_iter_id BIGINT REFERENCES workers.chat_model_eval_iterations (id) ON DELETE CASCADE,

  -- for each ner_run, the set of PDFs given to run are stored in workers.ner_run_pdfs

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workers.ner_run_pdfs (
  "id" BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY (START WITH 1),
  pdf_id UUID NOT NULL REFERENCES core.pdfs (id) ON DELETE CASCADE,
  ner_run_id UUID NOT NULL REFERENCES workers.ner_runs (id) ON DELETE CASCADE,

  -- which text extraction was used for this pdf and ner_run. context_eng_iter, model_eval_iter, etc. won't extract text if text already extracted by the method
  pdf_txt_id BIGINT REFERENCES workers.pdf_txts (id) ON DELETE SET NULL,

  -- for each ner_run_pdf, entries in core.entity_values with that pdf_id and is_label = false are created for each entity type prediction

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ner_runs_context_eng_iter_id_idx
ON workers.ner_runs (context_eng_iter_id)
WHERE context_eng_iter_id IS NOT NULL;

CREATE INDEX ner_runs_model_eval_iter_id_idx
ON workers.ner_runs (model_eval_iter_id)
WHERE model_eval_iter_id IS NOT NULL;

-- migrate:down
DROP INDEX workers.ner_runs_model_eval_iter_id_idx;
DROP INDEX workers.ner_runs_context_eng_iter_id_idx;
DROP TABLE workers.ner_run_pdfs;
DROP TABLE workers.ner_runs;
