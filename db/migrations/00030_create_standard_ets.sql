-- migrate:up
CREATE TABLE api.std_entity_types (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY (START WITH 1),
  short_name TEXT NOT NULL, -- could be abbreviation like ssn for Social Security Number or bank_acct for bank account number
  long_name TEXT,
  "definition" TEXT,
  examples TEXT[],
  format_description TEXT,
  datatype TEXT CHECK (datatype IN ('int', 'float', 'alphanumeric', 'alpha')),
  regex TEXT,
  exact_length INT,
  single_word BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER std_entity_types_updated_at
BEFORE UPDATE ON api.std_entity_types
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER std_entity_types_updated_at ON api.std_entity_types;
DROP TABLE api.std_entity_types;