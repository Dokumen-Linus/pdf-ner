# Database

## Conventions

- `db\migrations` are the source of truth for database objects
- Post-instantiation dbmate migration filenames must use a unique numeric version before the first underscore; prefer `YYYYMMDDhhmmss_description.sql`
- `db\seeds` insert data into objects defined by migrations
- Generated schema dumps are reference artifacts, not creation inputs

## Schema Ownership

- PUBLIC schema is maintainer-controlled seed/reference data and should not be written by apps
- Better Auth writes only to AUTH
- Web writes only to WEB except documented exceptions to write to CORE
- API writes only to API except documented exceptions to write to CORE
- Workers write only to WORKERS except documented exceptions to write to CORE
