# Dokumen AI Monorepo

## db

The PostgreSQL database is defined by SQL scripts. Migrations are performed by dbmate. The database server needs to be started before running code that depends on it. The database will be saved locally in .\pgdata. To start, run this script in a separate, dedicated terminal:

```cmd
pg_ctl -D .\pgdata -l logfile start
```

## frontend

The web app is hosted in its own directory. Your terminal should be in this directory to run package.json scripts or any Node.js/Bun.js commands. Javascript libraries must be saved in ./frontend/node_modules/.

## backend

The core REST API is hosted in its own directory. Your terminal should be in this directory to run Python commands, including uvicorn and conda. Python libraries must be saved in ./backend/conda_env/.
