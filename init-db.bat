@echo off
setlocal EnableDelayedExpansion

echo ========================================
echo PostgreSQL Database Setup Script
echo ========================================
echo.

:: 1. Initialize PostgreSQL data directory
echo [1/6] Initializing database cluster...
initdb -D .\pgdata
if %errorlevel% neq 0 (
    echo ERROR: initdb failed!
    pause
    exit /b 1
)

:: 2. Start PostgreSQL server
echo [2/6] Starting PostgreSQL server...
pg_ctl -D .\pgdata -l logfile start
if %errorlevel% neq 0 (
    echo ERROR: Failed to start PostgreSQL!
    pause
    exit /b 1
)

:: Give the server a moment to fully start
timeout /t 3 /nobreak >nul

:: 3. Create the database
echo [3/6] Creating database "dokumen"...
createdb dokumen
if %errorlevel% neq 0 (
    echo WARNING: createdb returned error (database may already exist)
)

:: 4. Run initial SQL script
echo [4/6] Running initial migration _init.sql...
psql -d dokumen -f db\migrations\_init.sql
if %errorlevel% neq 0 (
    echo ERROR: Failed to run _init.sql
    pause
    exit /b 1
)

:: 5. Run dbmate migrations
echo [5/6] Running dbmate migrations...
dbmate --url "postgres://owner_role:...@localhost:5432/dokumen?sslmode=disable" --migrations-dir=db\migrations up
if %errorlevel% neq 0 (
    echo ERROR: dbmate migrations failed!
    pause
    exit /b 1
)

:: 6. Run better-auth specific migration
echo [6/6] Running better-auth migration...
psql -f .\db\migrations\better-auth\2025-12-22T03-27-15.344Z.sql -d dokumen
if %errorlevel% neq 0 (
    echo WARNING: better-auth migration returned error (file may not exist or already applied)
)

:: 7. Run all seed files
echo.
echo Running seed files...
for %%f in (db\seeds\*.sql) do (
    echo Executing %%f
    psql -d dokumen -f "%%f"
    if %errorlevel% neq 0 (
        echo WARNING: Failed to execute %%f
    )
)

echo.
echo ========================================
echo Database setup completed successfully!
echo ========================================
echo.
echo You can now connect to database "dokumen"

pause