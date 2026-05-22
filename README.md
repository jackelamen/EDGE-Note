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
- `npm run verify:prod-env` checks required production environment variables.
- `npm run smoke:prod -- --url https://your-edge-note-domain.example` checks deployed public endpoints, security headers, database diagnostics, and production origin protection.
- Use [docs/smoke-test.md](docs/smoke-test.md) for the full runtime checklist.
- Use [docs/hostinger-deployment.md](docs/hostinger-deployment.md) for Hostinger setup.
- Use [docs/mobile-sync.md](docs/mobile-sync.md) for the mobile/offline sync contract.

## AI Actions

Manual AI actions currently support summarize, extract tasks, suggest tags, create title, clean up, find related, and ask note. Endpoint-backed actions cache their output by note content, action, model name, and question text. Find related runs locally against saved note titles, bodies, and tags, so it works even when `AI_ENDPOINT_URL` is not configured.

## Useful Routes

- `/` serves the web app
- `/api/health` confirms the Node process is alive
- `/api/config` exposes safe client settings
- `GET /api/auth/status` checks login/setup state
- `POST /api/auth/setup` sets the first owner password
- `POST /api/auth/login` logs in
- `POST /api/auth/logout` logs out
- `POST /api/auth/change-password` changes the owner password and logs out
- `GET /api/notebooks` lists notebooks
- `POST /api/notebooks` creates a notebook
- `GET /api/tags` lists tags
- `POST /api/tags` creates tags
- `GET /api/devices` lists registered sync devices
- `POST /api/devices` registers or updates a sync device
- `PUT /api/devices/:id/cursor` updates one device sync cursor
- `GET /api/sync/pull?cursor=0` pulls incremental change records
- `POST /api/sync/push` pushes note create/update/delete batches
- `GET /api/export/status` checks export counts and missing attachment files
- `GET /api/export.json` downloads a portable JSON backup
- `GET /api/export.md` downloads notes as Markdown
- `GET /api/export.tgz` downloads a tar.gz archive with notes, manifest, and attachment files
- `GET /api/notes/:id/attachments` lists note attachments
- `POST /api/notes/:id/attachments` uploads a file to Hostinger storage
- `PUT /api/attachments/:id` replaces an attachment file
- `DELETE /api/attachments/:id` deletes an attachment file
- `GET /api/attachments/:id/thumbnail` lazily serves a generated attachment thumbnail when available
- `GET /api/attachments/:id/download` lazily downloads one attachment
- `POST /api/notes/:id/ai/:action` runs a cached manual AI action
- `GET /api/notes` lists notes for the first owner account and supports `q`, `notebookId`, `tag`, `favorite`, `tasks`, and `archived` filters
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

For an existing database created before Batch 10, import `database/migrations/0010_attachment_thumbnails.sql` once before uploading new image attachments.

Set `EDGE_NOTE_OWNER_USER_ID` to the seeded owner user id. The private first-user build defaults to `1`.
Set `EDGE_NOTE_SESSION_SECRET` to a long random value before hosting the app.

## Local Cache

The browser caches the latest note list, notebook list, tag list, selected note, saved searches, and unsynced draft edits in `localStorage`. This is an early safety layer, not full sync yet: if MySQL is offline, the app can show cached notes and preserve the current draft until you sync again.

## Attachments

Attachments are limited by `ATTACHMENT_LIMIT_MB`, defaulting to 25 MB. The browser checks the limit before upload and generates a small WebP thumbnail for image files before sending them to the server. Attachments can be replaced or deleted from the note panel. Archive export records missing attachment files or thumbnails in `manifest.json` instead of failing the whole backup.

## Backup Checks

Use the Backup panel's Check button before downloading exports. It calls `/api/export/status` and reports note counts, attachment counts, total attachment size, and any missing attachment or thumbnail files. JSON and archive exports include the same summary, and archive manifests include per-file checksums for notes, attachments, and thumbnails.

## Keyboard Shortcuts

- `Cmd/Ctrl+S` syncs the current note.
- `Cmd/Ctrl+K` focuses search.
- `Cmd/Ctrl+N` starts a new note.
- `Cmd/Ctrl+P` toggles preview.
- `Cmd/Ctrl+B` and `Cmd/Ctrl+I` format selected text.
- `Cmd/Ctrl+Enter` inserts a checklist item.
- `Cmd/Ctrl+Up` and `Cmd/Ctrl+Down` move through the visible note list.

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

1. Mobile sync readiness.
2. AI endpoint production setup.
3. Data safety tools.

## Hostinger Notes

The app is intentionally boring Node plus SQL. Attachments should live on Hostinger file storage for the early version, and Gemma should be called through a configurable external HTTP endpoint rather than running inference on the Hostinger plan.
