-- migrate:up
ALTER TABLE web.users
  ADD COLUMN auth_user_id TEXT;

CREATE UNIQUE INDEX users_auth_user_id_uidx
  ON web.users (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Backfill rows that already have a matching Better Auth user by email.
UPDATE web.users AS wu
SET auth_user_id = au.id
FROM auth."user" AS au
WHERE wu.auth_user_id IS NULL
  AND lower(wu.email) = lower(au.email);

-- migrate:down
DROP INDEX IF EXISTS web.users_auth_user_id_uidx;
ALTER TABLE web.users
  DROP COLUMN IF EXISTS auth_user_id;
