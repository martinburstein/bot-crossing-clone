@echo off
cd /d "%~dp0"
node tools/dual-view.mjs
if errorlevel 1 pause
