-- migrate:up
ALTER TABLE web.users
ADD COLUMN display_name TEXT;

UPDATE web.users
SET display_name = COALESCE(
  NULLIF(split_part(email, '@', 1), ''),
  NULLIF(trim(concat_ws(' ', first_name, last_name)), '')
)
WHERE display_name IS NULL;

-- migrate:down
ALTER TABLE web.users
DROP COLUMN display_name;
