@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "REPO_ROOT=%%~fI"
set "COMPOSE_FILE=%REPO_ROOT%\infra\docker-compose.yml"

if not defined POSTGRES_USER set "POSTGRES_USER=postgres"
if not defined POSTGRES_DB set "POSTGRES_DB=dokumen"
if not defined POSTGRES_PASSWORD set "POSTGRES_PASSWORD=dokumen"
if not defined OWNER_ROLE_PASSWORD set "OWNER_ROLE_PASSWORD=owner_pw"
if not defined AUTH_ROLE_PASSWORD set "AUTH_ROLE_PASSWORD=auth_pw"
if not defined WEB_USER_PASSWORD set "WEB_USER_PASSWORD=web_pw"
if not defined API_USER_PASSWORD set "API_USER_PASSWORD=api_pw"
if not defined WORKERS_USER_PASSWORD set "WORKERS_USER_PASSWORD=workers_pw"

docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: docker is required to run the local database.
    exit /b 1
)

echo Starting local PostgreSQL container...
echo Using %COMPOSE_FILE%

docker compose -f "%COMPOSE_FILE%" --profile local-db up -d --build db
if errorlevel 1 (
    echo ERROR: docker compose failed.
    exit /b 1
)

for /f "usebackq delims=" %%I in (`docker compose -f "%COMPOSE_FILE%" --profile local-db ps -q db`) do set "CONTAINER_ID=%%I"
if not defined CONTAINER_ID (
    echo ERROR: db container was not created.
    exit /b 1
)

echo Waiting for local PostgreSQL healthcheck...
for /l %%N in (1,1,60) do (
    for /f "usebackq delims=" %%S in (`docker inspect --format="{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}" "%CONTAINER_ID%"`) do set "HEALTH_STATUS=%%S"
    if "!HEALTH_STATUS!"=="healthy" (
        for /f "usebackq delims=" %%R in (`docker exec "%CONTAINER_ID%" psql -U "%POSTGRES_USER%" -d "%POSTGRES_DB%" -Atc "SELECT to_regclass('auth.user') IS NOT NULL AND to_regclass('web.users') IS NOT NULL AND to_regclass('core.prompts') IS NOT NULL AND to_regclass('public.chat_models') IS NOT NULL AND to_regclass('public.std_entity_types') IS NOT NULL;"`) do set "SMOKE_RESULT=%%R"
        if not "!SMOKE_RESULT!"=="t" (
            echo ERROR: local PostgreSQL is healthy, but expected app tables are missing. Recent logs:
            docker logs --tail 120 "%CONTAINER_ID%"
            exit /b 1
        )
        echo Local PostgreSQL is healthy.
        echo Schema smoke check passed.
        echo Database: %POSTGRES_DB%
        echo Admin user: %POSTGRES_USER%
        echo Port: container-only unless you publish it in infra\docker-compose.yml
        exit /b 0
    )
    if "!HEALTH_STATUS!"=="unhealthy" (
        echo ERROR: local PostgreSQL became unhealthy. Recent logs:
        docker logs --tail 80 "%CONTAINER_ID%"
        exit /b 1
    )
    timeout /t 2 /nobreak >nul
)

echo ERROR: timed out waiting for local PostgreSQL to become healthy. Recent logs:
docker logs --tail 80 "%CONTAINER_ID%"
exit /b 1
