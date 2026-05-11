# Database

## Current Phase

- Treat the schema as pre-production: modify existing create/setup SQL directly
- Do not add backward-compatibility migrations for column/table changes

## Conventions

- Keep SQL ordered in a way that leaves room for inserts where order matters
- SQL migrations are the source of truth for database objects
- Seeds insert data into objects defined by migrations
- Generated schema dumps are reference artifacts, not creation inputs

## Schema Ownership

- App schemas are owned by their corresponding app
- `public` is maintainer-controlled seed/reference data and should not be written by apps
- Better Auth writes only to `auth`
- Web writes only to `web` except documented exceptions to write to `core`
- API writes only to `api` except documented exceptions to write to `core`
- Workers write only to `workers` except documented exceptions to write to `core`
