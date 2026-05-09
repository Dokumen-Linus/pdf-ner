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
- Web writes only to `web`
- API writes only to `api`, except explicitly documented exceptions
- Workers write only to `workers`; if API and workers need shared write access, workers should own that schema
