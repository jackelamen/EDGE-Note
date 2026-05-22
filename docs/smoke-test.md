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

1. `GET /api/health` returns `ok: true`.
2. `GET /api/config` returns attachment limit, sync mode, and AI state.
3. `GET /api/auth/status` returns either setup required or authenticated state.

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
9. Clear search.
10. Click Favorites, Tasks, and Archive views.
11. Favorite the note.
12. Archive and restore the note.
13. Delete a temporary note and confirm it disappears.

## 5. Editor

1. Use H2, bold, italic, list, quote, code, and link formatting controls.
2. Toggle Preview.
3. Confirm headings, inline formatting, links, quotes, lists, and checklist items render.
4. Toggle back to Write mode and continue editing.

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

1. Run JSON export.
2. Run Markdown export.
3. Run Archive export.
4. Confirm the archive contains `manifest.json`, `notes/`, and `attachments/` when attachments exist.
5. Confirm `manifest.json` includes `missingAttachments` or `missingThumbnails` when any attachment file is missing from storage.

## 9. Sync API

1. `POST /api/devices` registers a device.
2. `GET /api/devices` returns the device.
3. `GET /api/sync/pull?cursor=0` returns sync changes.
4. `PUT /api/devices/:id/cursor` stores the latest applied cursor.
5. `POST /api/sync/push` can create a note.
6. `POST /api/sync/push` can update a note with the correct `baseSyncVersion`.
7. `POST /api/sync/push` returns `conflict` when `baseSyncVersion` is stale.
8. Trigger or simulate a queued stale edit and confirm the conflict panel shows server and local text side by side.
9. Resolve one conflict with Keep server, one with Use local, and one with Edit local.

## 10. AI

Only run this section when `AI_ENDPOINT_URL` is configured.

1. Run Summarize.
2. Run Extract tasks.
3. Run Suggest tags.
4. Run Create title.
5. Run Clean up and confirm cleaned text appears without replacing the note automatically.
6. Run Find related and confirm matching saved notes appear without requiring AI configuration.
7. Type a question in Ask this note and run Ask note.
8. Confirm repeated endpoint-backed actions can return cached output.

## Expected Result

The app can authenticate, create, edit, organize, search, version, export, attach files, change password, and preserve cached drafts without visible errors.
