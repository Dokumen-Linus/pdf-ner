-- migrate:up
CREATE TABLE public.templates (
  "id" BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY (START WITH 1),

  txt TEXT NOT NULL,
  includes_project_description BOOLEAN NOT NULL,
  includes_entity_type_definitions BOOLEAN NOT NULL,
  includes_entity_type_example_values BOOLEAN NOT NULL,
  includes_entity_type_example_finds BOOLEAN NOT NULL,
  includes_entity_type_regex BOOLEAN NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER templates_updated_at
BEFORE UPDATE ON public.templates
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER templates_updated_at ON public.templates;
DROP TABLE public.templates;