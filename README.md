# RTA App

A local-only reflexive thematic analysis tool. Everything — transcripts, codes, codebooks — stays on your machine; nothing is sent anywhere over the network.

## Run it (macOS or Windows)

**Prerequisite:** [Node.js](https://nodejs.org) (LTS version). Nothing else to install.

1. Download or clone this folder.
2. **macOS:** double-click `start-mac.command`.
   **Windows:** double-click `start-windows.bat`.
3. The first run installs dependencies and builds the app (a minute or two); every run after that starts instantly.
4. Your browser opens to `http://localhost:4000` automatically. Leave the terminal/command window open while you use the app; closing it stops the server.

If your OS blocks the script the first time (unrecognized publisher / unidentified developer)
- MacOS: run `xattr -d com.apple.quarantine path_to_command_file` in your terminal and then open the file again.
- right-click the file and choose "Open" once to approve it.

**Back up `/backend/rta-app.sqlite` when reinstalling the app.**

## Developing

For active development, run the backend and frontend as separate dev servers (hot reload, no build step):

```
npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:5173 (proxies /api to the backend)
```

Use the frontend dev server's URL (`:5173`) while developing. `npm run build && npm start` (or the launcher scripts above) serve the production build from a single port instead.

See [docs/architecture.md](docs/architecture.md) for project layout and [PROJECT.md](PROJECT.md) for the app's requirements.
