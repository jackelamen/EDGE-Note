# EDGE-Note

EDGE Note is a private, Hostinger-friendly Evernote replacement. The first version is built for one owner, with a path to portable sync, attachments, export, and Gemma-powered AI through an external endpoint.

## Current Build

This first shell includes:

- Node 22 HTTP server with `mysql2` for MySQL access
- Responsive notes workspace UI
- Health, config, and MySQL-backed notes API routes
- MySQL schema draft for the MVP data model
- Environment example for Hostinger-style deployment

## Run Locally

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:3000`.

For hosting environments that expect the app to bind to all interfaces, set `EDGE_NOTE_HOST=0.0.0.0`.

## Useful Routes

- `/` serves the web app
- `/api/health` confirms the Node process is alive
- `/api/config` exposes safe client settings
- `GET /api/notebooks` lists notebooks
- `POST /api/notebooks` creates a notebook
- `GET /api/tags` lists tags
- `POST /api/tags` creates tags
- `GET /api/sync/pull?cursor=0` pulls incremental change records
- `GET /api/export.json` downloads a portable JSON backup
- `GET /api/export.md` downloads notes as Markdown
- `GET /api/notes` lists notes for the first owner account
- `POST /api/notes` creates a note
- `GET /api/notes/:id` reads one note
- `PUT /api/notes/:id` updates a note and stores the previous body as a version
- `DELETE /api/notes/:id` soft deletes a note

## Database Setup

Create the MySQL database, then run:

```bash
mysql -u edge_note -p edge_note < database/schema.sql
mysql -u edge_note -p edge_note < database/seed.sql
```

Set `EDGE_NOTE_OWNER_USER_ID` to the seeded owner user id. The private first-user build defaults to `1` until login is added.

## Local Cache

The browser caches the latest note list, notebook list, tag list, selected note, and unsynced draft edits in `localStorage`. This is an early safety layer, not full sync yet: if MySQL is offline, the app can show cached notes and preserve the current draft until you sync again.

## Next Build Steps

1. Add login/session protection.
2. Add sync push/conflict handling.
3. Add attachment upload using Hostinger file storage.
4. Add first manual Gemma AI actions.
5. Add export and backup actions.

## Hostinger Notes

The app is intentionally boring Node plus SQL. Attachments should live on Hostinger file storage for the early version, and Gemma should be called through a configurable external HTTP endpoint rather than running inference on the Hostinger plan.
