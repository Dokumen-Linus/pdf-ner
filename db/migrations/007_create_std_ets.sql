-- migrate:up
CREATE TABLE public.std_entity_types (
  "id" BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY (START WITH 1),

  short_name TEXT NOT NULL, -- could be abbreviation like ssn for Social Security Number or bank_acct for bank account number
  long_name TEXT NOT NULL,
  category TEXT NOT NULL,
  "definition" TEXT NOT NULL,
  examples TEXT[],
  datatype TEXT CHECK (datatype IN ('int', 'float', 'alphanumeric', 'alpha', 'alpha_with_spaces')),
  regex TEXT,
  exact_length INT, -- populated when the entity type value must be a specific length, like 9 for ssn
  single_word BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER std_entity_types_updated_at
BEFORE UPDATE ON public.std_entity_types
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER std_entity_types_updated_at ON public.std_entity_types;
DROP TABLE public.std_entity_types;
