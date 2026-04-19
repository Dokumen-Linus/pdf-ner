-- migrate:up
CREATE TABLE web.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  employer TEXT,
  job_title TEXT,
  avatar_url TEXT,
  auth_user_id TEXT,
  organization_id TEXT REFERENCES auth.organization(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX users_auth_user_id_uidx
  ON web.users (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON web.users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER users_updated_at ON web.users;
DROP TABLE web.users;