-- migrate:up
CREATE TABLE web.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  employer TEXT,
  job_title TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON web.users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER users_updated_at ON web.users;
DROP TABLE web.users;