# Architecture Notes

High-level requirements live in [PROJECT.md](../PROJECT.md); this file covers implementation structure only.

## Layout

- `backend/` — Node/Express + TypeScript, SQLite via better-sqlite3.
  - `src/api/` — Express route definitions, one file per entity, mounted under `/api` in `src/api/index.ts`.
  - `src/services/` — business logic and DB access, one file per entity (`projectsService.ts`, `transcriptsService.ts`, etc.).
  - `src/models/` — `schema.sql` (DDL), `migrate.ts` (applies schema on startup), `types.ts` (shared domain types).
  - `src/core/` — `config.ts` (env), `db.ts` (SQLite connection), `logger.ts`, `ids.ts`.
- `frontend/` — React + TypeScript (Vite).
  - `src/types/domain.ts` — domain types mirrored from backend `models/types.ts`.
  - `src/api/` — thin fetch client per entity, all requests proxied to backend `/api`.
  - `src/hooks/` — data-fetching hooks (e.g. `useProjects`).
  - `src/pages/` — top-level views from PROJECT.md `<UI_SPEC>` (ProjectDashboard, ProjectSetupView, ProjectWorkspace).
  - `src/components/` — presentational/container components (TranscriptView, CodebookEditor, etc. to be added).

## Data flow

Frontend never talks to SQLite directly. All access goes through the Express API under `/api/*`, matching routes to services 1:1. The Vite dev server proxies `/api` to `http://localhost:4000`.

## Not yet implemented

- ComparisonView (A vs B) and Codebook comparison/merge UI.
- Codebook Excel (.xlsx) import/export.
- Project export/import (JSON/zip).
- Text selection → CodedExcerpt creation (Selection API + offset capture).
- Automated tests (unit tests for services, component tests for highlight rendering).

## Privacy

Backend logger (`src/core/logger.ts`) logs event names and IDs only — never `Transcript.raw_text` or q_code content. No telemetry/analytics anywhere in the app.
