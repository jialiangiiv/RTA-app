#!/usr/bin/env bash
# Double-click this file in Finder to install (first run only), build, and launch RTA App.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but wasn't found on this Mac."
  echo "Install it from https://nodejs.org (the LTS version), then double-click this file again."
  read -r -p "Press Enter to close this window..."
  exit 1
fi

if [ ! -d backend/node_modules ] || [ ! -d frontend/node_modules ]; then
  echo "Installing dependencies (first run only — this can take a minute)..."
  npm run setup
fi

if [ ! -f backend/.env ] && [ -f backend/.env.example ]; then
  cp backend/.env.example backend/.env
fi

if [ ! -d frontend/dist ]; then
  echo "Building the app (first run only)..."
  npm run build
fi

echo "Starting RTA App — opening http://localhost:4000 in your browser..."
( sleep 2 && open "http://localhost:4000" ) &
npm start
