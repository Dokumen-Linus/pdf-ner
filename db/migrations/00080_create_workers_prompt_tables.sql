-- migrate:up
CREATE TABLE workers.optimized_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
    template_id BIGINT NOT NULL REFERENCES public.templates (id) ON DELETE RESTRICT,
    full_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workers.optimized_prompt_examples (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY (START WITH 1),
    optimized_prompt_id UUID NOT NULL REFERENCES workers.optimized_prompts (id) ON DELETE CASCADE,
    pdf_id UUID NOT NULL REFERENCES workers.pdfs (id) ON DELETE CASCADE,
    example_order INTEGER NOT NULL,
    text_excerpt TEXT NOT NULL,
    labelled_entities JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (optimized_prompt_id, pdf_id),
    UNIQUE (optimized_prompt_id, example_order)
);

CREATE TABLE workers.prompt_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES workers.optimized_prompts (id) ON DELETE CASCADE,
    overall_f1 REAL NOT NULL,
    per_entity_scores JSONB NOT NULL,
    model_id TEXT REFERENCES public.models (id),
    labeled_pdf_count INTEGER,
    evaluated_pdf_count INTEGER,
    skipped_pdf_count INTEGER,
    pdfs_fully_correct INTEGER,
    pdf_accuracy REAL,
    entity_type_metrics JSONB,
    llm_call_count INTEGER,
    cost_usd NUMERIC(12, 8),
    iterations_run INTEGER,
    stop_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workers.context_eng_preds (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY (START WITH 1),
    prompt_evaluation_id UUID NOT NULL REFERENCES workers.prompt_evaluations (id) ON DELETE CASCADE,
    pdf_id UUID NOT NULL REFERENCES workers.pdfs (id) ON DELETE CASCADE,
    entity_type_id UUID NOT NULL REFERENCES web.entity_types (id) ON DELETE RESTRICT,
    labelled_value TEXT,
    predicted_value TEXT
);

CREATE INDEX context_eng_preds_prompt_evaluation_id_idx
    ON workers.context_eng_preds(prompt_evaluation_id);
CREATE INDEX context_eng_preds_pdf_id_idx ON workers.context_eng_preds(pdf_id);
CREATE INDEX context_eng_preds_entity_type_id_idx ON workers.context_eng_preds(entity_type_id);
CREATE INDEX optimized_prompt_examples_prompt_id_idx
    ON workers.optimized_prompt_examples(optimized_prompt_id);
CREATE INDEX optimized_prompt_examples_pdf_id_idx ON workers.optimized_prompt_examples(pdf_id);

-- migrate:down
DROP TABLE workers.context_eng_preds;
DROP TABLE workers.prompt_evaluations;
DROP TABLE workers.optimized_prompt_examples;
DROP TABLE workers.optimized_prompts;
