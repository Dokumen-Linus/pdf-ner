# Database

## Conventions

- `db\migrations` are the source of truth for database objects
- Post-instantiation dbmate migration filenames must use a unique numeric version before the first underscore; prefer `YYYYMMDDhhmmss_description.sql`
- `db\seeds` insert data into objects defined by migrations
- Generated schema dumps are reference artifacts, not creation inputs

## Schema Ownership

- App schemas are owned by their corresponding app
- `public` is maintainer-controlled seed/reference data and should not be written by apps
- Better Auth writes only to `auth`
- Web writes only to `web` except documented exceptions to write to `core`
- API writes only to `api` except documented exceptions to write to `core`
- Workers write only to `workers` except documented exceptions to write to `core`
