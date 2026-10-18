@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js 18 or newer is required. Install the LTS version from https://nodejs.org/
 pause
 exit /b 1
)
if "%INGEST_TOKEN%"=="" set "INGEST_TOKEN=local-testing-only-change-me"
start "" "http://127.0.0.1:8787/dashboard"
node server.js
pause
