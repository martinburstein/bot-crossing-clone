@echo off
cd /d "%~dp0"
node tools/financial-office.mjs
if errorlevel 1 pause
