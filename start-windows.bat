@echo off
REM Double-click this file in File Explorer to install (first run only), build, and launch RTA App.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required but wasn't found on this PC.
  echo Install it from https://nodejs.org ^(the LTS version^), then double-click this file again.
  pause
  exit /b 1
)

if not exist backend\node_modules goto :install
if not exist frontend\node_modules goto :install
goto :afterinstall

:install
echo Installing dependencies (first run only - this can take a minute)...
call npm run setup
if errorlevel 1 (
  pause
  exit /b 1
)

:afterinstall
if not exist backend\.env (
  if exist backend\.env.example copy backend\.env.example backend\.env >nul
)

if not exist frontend\dist (
  echo Building the app (first run only)...
  call npm run build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

echo Starting RTA App - opening http://localhost:4000 in your browser...
start "" http://localhost:4000
call npm start
pause
