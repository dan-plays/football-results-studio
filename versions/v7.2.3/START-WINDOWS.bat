@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js 18 or newer is required. Install the LTS version from https://nodejs.org/
 pause
 exit /b 1
)
for /f %%K in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString()" ') do set "INGEST_TOKEN=%%K"
set "API_FOOTBALL_KEY="
REM SportScore is the default free provider. No API key is needed.
REM Paste your own API-Football key between the quotes above. Never share this file with your key in it.
echo.
echo Football Results Studio dashboard key: %INGEST_TOKEN%
echo.
start "" "http://127.0.0.1:8787/dashboard"
node server.js
pause
