# EDGE Note Smoke Test

Run this checklist after schema import and before any deployment handoff.

## Setup

1. Run `npm install`.
2. Copy `.env.example` to `.env`.
3. Fill in MySQL values and `EDGE_NOTE_SESSION_SECRET`.
4. Import `database/schema.sql`.
5. Import `database/seed.sql`.
6. Run `npm run verify`.
7. Run `npm run dev`.

## Browser Flow

1. Open `http://localhost:3000`.
2. Set the owner password if prompted.
3. Log out and log back in.
4. Create a note.
5. Edit the note title and body.
6. Add a notebook and tags.
7. Sync/save the note.
8. Refresh the page and confirm the note reloads.
9. Upload a small attachment.
10. Download the attachment from the attachment list.
11. Run JSON export.
12. Run Markdown export.
13. If `AI_ENDPOINT_URL` is configured, run Summarize and Suggest tags.

## API Flow

1. `GET /api/health` returns `ok: true`.
2. `GET /api/auth/status` returns authenticated state.
3. `GET /api/notes` returns the saved note.
4. `GET /api/sync/pull?cursor=0` returns sync changes.
5. `POST /api/sync/push` returns applied or conflict results for note changes.

## Expected Result

The app can create, edit, reload, search, export, attach files, and preserve cached drafts without errors.
