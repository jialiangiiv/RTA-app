@echo off
REM Double-click this file in File Explorer to install (first run only), build, and launch RTA App.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto :nonode

if not exist backend\node_modules goto :install
if not exist frontend\node_modules goto :install
goto :afterinstall

:install
echo Installing dependencies (first run only - this can take a minute)...
call npm run setup
if errorlevel 1 goto :fail

:afterinstall
if exist backend\.env goto :afterenv
if not exist backend\.env.example goto :afterenv
copy backend\.env.example backend\.env >nul

:afterenv
if exist frontend\dist goto :afterbuild
echo Building the app (first run only)...
call npm run build
if errorlevel 1 goto :fail

:afterbuild
echo Starting RTA App - opening http://localhost:4000 in your browser...
start "" http://localhost:4000
call npm start
pause
exit /b 0

:nonode
echo Node.js is required but wasn't found on this PC.
echo Install it from https://nodejs.org (the LTS version), then double-click this file again.
pause
exit /b 1

:fail
pause
exit /b 1
