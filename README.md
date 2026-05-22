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
npm run verify
npm run dev
```

Open `http://localhost:3000`.

For hosting environments that expect the app to bind to all interfaces, set `EDGE_NOTE_HOST=0.0.0.0`.

## Verification

- `npm run check` verifies JavaScript syntax.
- `npm run verify` checks syntax plus the expected env keys, database tables, and UI hooks.
- Use [docs/smoke-test.md](docs/smoke-test.md) for the manual runtime checklist.
- Use [docs/hostinger-deployment.md](docs/hostinger-deployment.md) for Hostinger setup.

## Useful Routes

- `/` serves the web app
- `/api/health` confirms the Node process is alive
- `/api/config` exposes safe client settings
- `GET /api/auth/status` checks login/setup state
- `POST /api/auth/setup` sets the first owner password
- `POST /api/auth/login` logs in
- `POST /api/auth/logout` logs out
- `GET /api/notebooks` lists notebooks
- `POST /api/notebooks` creates a notebook
- `GET /api/tags` lists tags
- `POST /api/tags` creates tags
- `GET /api/sync/pull?cursor=0` pulls incremental change records
- `POST /api/sync/push` pushes note create/update/delete batches
- `GET /api/export.json` downloads a portable JSON backup
- `GET /api/export.md` downloads notes as Markdown
- `GET /api/notes/:id/attachments` lists note attachments
- `POST /api/notes/:id/attachments` uploads a file to Hostinger storage
- `GET /api/attachments/:id/download` lazily downloads one attachment
- `POST /api/notes/:id/ai/:action` runs a cached manual AI action
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

Set `EDGE_NOTE_OWNER_USER_ID` to the seeded owner user id. The private first-user build defaults to `1`.
Set `EDGE_NOTE_SESSION_SECRET` to a long random value before hosting the app.

## Local Cache

The browser caches the latest note list, notebook list, tag list, selected note, and unsynced draft edits in `localStorage`. This is an early safety layer, not full sync yet: if MySQL is offline, the app can show cached notes and preserve the current draft until you sync again.

## Attachments

Attachments are limited by `ATTACHMENT_LIMIT_MB`, defaulting to 25 MB. The browser checks the limit before upload, and image attachments render as lightweight preview rows using the lazy download URL. Full generated thumbnails can come later without changing the metadata contract.

## Sync Push

`POST /api/sync/push` accepts up to 50 note changes per request:

```json
{
  "changes": [
    {
      "clientId": "mobile-1",
      "entityType": "note",
      "action": "update",
      "entityId": 123,
      "baseSyncVersion": 4,
      "data": {
        "title": "Updated title",
        "body": "Updated body",
        "tags": ["mobile"]
      }
    }
  ]
}
```

Updates with a stale `baseSyncVersion` return `conflict` and include the current server note. The server does not silently overwrite conflicting note bodies.

## Next Build Steps

1. Add export packaging for attachment files.
2. Add password reset/change flow.
3. Add hosted deployment checklist.
4. Add mobile cache schema.
5. Add generated attachment thumbnails.

## Hostinger Notes

The app is intentionally boring Node plus SQL. Attachments should live on Hostinger file storage for the early version, and Gemma should be called through a configurable external HTTP endpoint rather than running inference on the Hostinger plan.
