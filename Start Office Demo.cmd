@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js, then run this launcher again.
  pause
  exit /b 1
)
start "" "http://127.0.0.1:8770"
node server.mjs
pause
