# Celery Worker App

## Tech Stack

- Framework: [Celery](https://docs.celeryq.dev/en/stable/index.html)
- Message Broker: [Redis](https://redis.io/)

## Database

### How Database is Exposed to Workers

1. The database schemas are defined in ./db/migrations/ SQL scripts

**Restriction on Workers Interactions with Database**: 

### Start Instructions

Must start the database server before running the FastAPI app. Should run the app and db start commands in separate terminals so that terminating one does not terminate the other.

```cmd
pg_ctl -D .\pgdata -l logfile start
```

### Schemas

#### Auth Schema

Workers do not touch authentication.

#### Web Schema

Contains all tables for the web app defined in ./db/migrations/web. Role workers_user has read-only access.

#### Api Schema

Contains all tables for the backend API defined in ./db/migrations/api. Role workers_user has read-only access.

#### Workers Schema

Contains all tables for the backend workers defined in ./db/migrations/workers. Role owner_role owns the schema so it can be used in migrations. Role workers_user can edit tables (not create or delete tables).
