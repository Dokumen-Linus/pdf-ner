-- migrate:up
CREATE TABLE workers.optimized_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
    full_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workers.prompt_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES workers.optimized_prompts (id) ON DELETE CASCADE,
    overall_f1 REAL NOT NULL,
    per_entity_scores JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- migrate:down
DROP TABLE workers.prompt_evaluations;
DROP TABLE workers.optimized_prompts;
