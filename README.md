# EDGE-Note

EDGE Note is a private, Hostinger-friendly Evernote replacement. The first version is built for one owner, with a path to portable sync, attachments, export, and Gemma-powered AI through an external endpoint.

## Current Build

This first shell includes:

- Node 22 HTTP server with no required runtime dependencies
- Responsive notes workspace UI
- Health, config, and placeholder notes API routes
- MySQL schema draft for the MVP data model
- Environment example for Hostinger-style deployment

## Run Locally

```bash
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

For hosting environments that expect the app to bind to all interfaces, set `EDGE_NOTE_HOST=0.0.0.0`.

## Useful Routes

- `/` serves the web app
- `/api/health` confirms the Node process is alive
- `/api/config` exposes safe client settings
- `/api/notes` is a placeholder for the MySQL-backed notes API

## Next Build Steps

1. Add a small MySQL connection layer.
2. Seed the first owner account and default notebooks.
3. Replace placeholder notes with real CRUD endpoints.
4. Add login/session protection.
5. Persist local edits and prepare incremental sync.

## Hostinger Notes

The app is intentionally boring Node plus SQL. Attachments should live on Hostinger file storage for the early version, and Gemma should be called through a configurable external HTTP endpoint rather than running inference on the Hostinger plan.
