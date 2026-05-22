# EDGE Note Smoke Test

Run this checklist after schema import and before any deployment handoff.

## 1. Setup

1. Run `npm install`.
2. Copy `.env.example` to `.env`.
3. Fill in MySQL values and `EDGE_NOTE_SESSION_SECRET`.
4. Import `database/schema.sql`.
5. Import `database/seed.sql`.
6. Run `npm run verify`.
7. For production values, run `npm run verify:prod-env`.
8. Run `npm run dev` locally or restart the Hostinger Node app in production.

## 2. Basic API

Run the automated production-safe smoke check against the deployed URL:

```bash
EDGE_NOTE_SMOKE_URL=https://your-edge-note-domain.example npm run smoke:prod
```

Or:

```bash
npm run smoke:prod -- --url https://your-edge-note-domain.example
```

It checks:

1. `GET /api/health` returns `ok: true`.
2. `GET /api/config` returns attachment limit, sync mode, and AI state.
3. `GET /api/auth/status` returns either setup required or authenticated state.
4. `GET /api/setup/database-diagnostics` can reach the configured database and reports target details without the password.
5. Security headers are present on public JSON responses.
6. A cross-origin write request is rejected in production.

If the automated smoke check fails at the origin-protection step, confirm the deployed app is running with `EDGE_NOTE_ENV=production` and `EDGE_NOTE_PUBLIC_URL` exactly matches the live HTTPS origin.

## 3. Auth

1. Open the app root.
2. Set the owner password if prompted.
3. Log out and log back in.
4. Open Security.
5. Change the password.
6. Confirm the app logs out.
7. Log in with the new password.

## 4. Notes And Organization

1. Create a notebook.
2. Create a note inside that notebook.
3. Add a title, body, tags, and at least one checklist item.
4. Save the note.
5. Refresh the page and confirm the note reloads.
6. Click notebook and tag filters.
7. Search for a title word and confirm the result count changes.
8. Search for a body word and confirm the note preview shows matching context.
9. Save the search with a name.
10. Clear search.
11. Load the saved search and confirm the text/filter returns.
12. Delete the saved search.
13. Click Favorites, Tasks, and Archive views.
14. Favorite the note.
15. Archive and restore the note.
16. Delete a temporary note and confirm it disappears.

## 5. Editor

1. Use H2, bold, italic, list, quote, code, and link formatting controls.
2. Toggle Preview.
3. Confirm headings, inline formatting, links, quotes, lists, and checklist items render.
4. Toggle back to Write mode and continue editing.
5. Use `Cmd/Ctrl+S` to sync.
6. Use `Cmd/Ctrl+K` to focus search.
7. Use `Cmd/Ctrl+N` to start a new note.
8. Use `Cmd/Ctrl+P` to toggle preview.
9. Use `Cmd/Ctrl+B`, `Cmd/Ctrl+I`, and `Cmd/Ctrl+Enter` in the editor.
10. Use `Cmd/Ctrl+Up` and `Cmd/Ctrl+Down` to move through visible notes.

## 6. History

1. Save a note.
2. Edit the body and save again.
3. Confirm the History panel shows a prior version.
4. Restore the prior version.
5. Confirm the current version is also preserved in History.

## 7. Attachments

1. Upload a small image.
2. Confirm it appears in the attachment list with a generated thumbnail.
3. Open `/api/attachments/:id/thumbnail` for the image and confirm it returns an image.
4. Download it from the attachment list.
5. Upload a non-image file.
6. Confirm the generic file row renders and downloads.
7. Choose a new file and replace an existing attachment.
8. Delete a temporary attachment and confirm it disappears.

## 8. Export

1. Run the Backup Check action and confirm counts match the current workspace.
2. Run JSON export and confirm it includes `summary`.
3. Run Markdown export.
4. Run Archive export.
5. Confirm the archive contains `manifest.json`, `notes/`, and `attachments/` when attachments exist.
6. Confirm `manifest.json` includes `summary`, `files`, and missing-file reporting when any attachment file is missing from storage.

## 9. Sync API

1. `POST /api/devices` with a stable `deviceKey` registers a device.
2. `GET /api/devices` returns the device.
3. `GET /api/sync/bootstrap` returns `entities` and a numeric `cursor`.
4. `GET /api/sync/pull?cursor=0&include=entities` returns sync changes and matching entity payloads.
5. `PUT /api/devices/:id/cursor` stores the latest applied cursor.
6. `POST /api/sync/push` can create a note and returns a fresh `cursor`.
7. `POST /api/sync/push` can update a note with the correct `baseSyncVersion`.
8. `POST /api/sync/push` returns `conflict` when `baseSyncVersion` is stale.
9. Trigger or simulate a queued stale edit and confirm the conflict panel shows server and local text side by side.
10. Resolve one conflict with Keep server, one with Use local, and one with Edit local.

## 10. AI

Only run this section when `AI_ENDPOINT_URL` is configured.

1. Run `npm run verify:ai` from the deployed environment or Hostinger terminal.
2. Open `GET /api/ai/status` while logged in and confirm `ok: true`.
3. Run Summarize.
4. Run Extract tasks.
5. Run Suggest tags.
6. Run Create title.
7. Run Clean up and confirm cleaned text appears without replacing the note automatically.
8. Run Find related and confirm matching saved notes appear without requiring AI configuration.
9. Type a question in Ask this note and run Ask note.
10. Confirm repeated endpoint-backed actions can return cached output.

## Expected Result

The app can authenticate, create, edit, organize, search, version, export, attach files, change password, and preserve cached drafts without visible errors.
