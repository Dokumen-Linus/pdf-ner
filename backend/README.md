# Dokumen AI Backend FastAPI

## Quickstart

1 Install [Anaconda Python distribution](https://www.anaconda.com/download)

2 Create Python environment and install libraries

```cmd
conda create --prefix ./conda_env python=3.13
conda activate .\conda_env
conda install -c conda-forge --file requirements.txt
pip install -r requirements.txt
```

Using v3.13 until most libraries have upgraded to 3.14

### Running the backend app

1 Start the database server

```cmd
pg_ctl -D .\pgdata -l logfile start
```

2 Activate the Python environment

```cmd
conda activate .\conda_env
```

3 Ensure .env is created following to .env.local.example

4 Run the app as a module (not a script)

```cmd
uvicorn app.main:app --reload
```

### Fast API Endpoint VSCode Extension

Visualizes the endpoints exposed by the api and what file defines them

## Fast API Framework

### Root files

- main.py: builds the Fast API app from the router in api.py, should rarely be updated
- api.py: imports all endpoints from the various domains/**/router.py, should be updated when creating a new domain

### Directories

- Core: global functionalities like config and logging
- DB: creates client to perform SQL queries
- Domains: contains different domains, which are groups of endpoints to acheive a business purpose
- Tests: test files
- Utils: generic code not specific to a business purpose that could be re-used in a hypothetical new domain

### Domains

Each domain must have the following files:

1. router.py - defines what endpoints are exposed
1. schema.py - defines types for endpoint responses
1. service.py - creates class functions to perform the main business logic/purpose of the endpoint
1. repository.py - executes SQL queries to handle necessary database interaction

Each domain should follow the template domains/_template. Only router.py exposes functions, the other three expose classes.

## Database

### Start Instructions

Must start the database server before running the FastAPI app. Should run the app and db start commands in separate terminals so that terminating one does not terminate the other.

### Schemas

#### Public Schema

Only used for migration scripts.

#### Auth Schema

Contains all tables for authentication (not authorization). Role api_user has no access.

#### App Schema

Contains all tables for the frontend defined in ./db/migrations/. Role api_user has read-only access.

#### Api Schema

Contains all tables for the backend defined in ./db/migrations/. Role api_owner owns the schema so it can be used in migrations. Role api_user can only edit tables so that asyncpg can't create or delete tables etc.

### How Database is Exposed to API

1. The database schemas are defined in ./db/migrations/ SQL scripts
2. ./backend/db/client.py defines the PostgreSQL client that can execute read-write queries to api schema and read queries to app schema
3. ./backend/domains/**/repository.py files import ./backend/db/client. in order to execute SQL queries

The SQL queries may need to change if the database schema is modified

### **Restriction on API Interactions with Database**

The backend can only interact with database through queries in repository.py files. No other files may interact with the database. No ORM or Python schema for the SQL database is allowed.
