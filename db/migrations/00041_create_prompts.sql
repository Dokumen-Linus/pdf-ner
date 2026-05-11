-- migrate:up
CREATE TABLE core.prompts (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES web.projects (id) ON DELETE CASCADE,
  template_id BIGINT NOT NULL REFERENCES public.templates (id) ON DELETE RESTRICT,

  project_description TEXT,
  entity_types_order UUID[], -- list of web.entity_types.id in the order to display in prompt and following lists
  entity_type_definitions JSONB, -- dict of entity type id to definition. definition is user_definition or made by workers based on user_definition, user_format_description, datatype
  entity_type_example_values JSONB, -- dict of entity type id to list of example entity values
  entity_type_example_finds JSONB, -- dict of entity type id to list of examples of recognizing an entity value

  full_text TEXT, -- template text with project_descr, entity_type_definitions, entity_type_example_values, entity_type_example_finds,
  -- and the constant regex for each entity type (from web.entity_types) in this row's web.projects
  -- only want full_text to be saved (nonnull) when a prompt becomes the active_prompt_id for its project, otherwise this is unhelpful repetitive storage

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER prompts_updated_at
BEFORE UPDATE ON core.prompts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- prompt to use for predictions in that project
ALTER TABLE web.projects ADD COLUMN active_prompt_id UUID REFERENCES core.prompts (id) ON DELETE SET NULL;

-- migrate:down
ALTER TABLE web.projects DROP COLUMN active_prompt_id;
DROP TRIGGER prompts_updated_at ON core.prompts;
DROP TABLE core.prompts;
