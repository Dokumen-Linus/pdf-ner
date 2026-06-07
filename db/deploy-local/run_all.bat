@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "RUN_ALL_SH=%SCRIPT_DIR%run_all.sh"

bash --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: bash is required to run the local database deploy scripts.
    exit /b 1
)

bash "%RUN_ALL_SH%"
exit /b %ERRORLEVEL%
