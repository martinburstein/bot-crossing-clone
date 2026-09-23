@echo off
node "%~dp0tools\sync.mjs" %*
exit /b %errorlevel%
