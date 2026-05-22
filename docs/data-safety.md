# Data Safety Tools

EDGE Note has two backup layers:

1. Download exports from the Backup panel.
2. Server-side saved backup archives under `BACKUP_ROOT`.

## Before Risky Work

Use this sequence before schema imports, production deployment changes, bulk cleanup, or anything that may affect stored notes:

1. Run Backup Check in the app.
2. Click Save in the Backup panel.
3. Click List and confirm a recent backup appears.
4. Download the newest saved backup.
5. Export MySQL from phpMyAdmin if schema or data changes are involved.
6. Copy the `uploads` directory if attachment storage changes are involved.

## Server-Side Backups

`POST /api/backups` creates a `.tar.gz` archive under `BACKUP_ROOT`.

The archive contains:

- `manifest.json`
- Markdown note files
- attachment files when present
- thumbnail files when present
- per-file checksums in the manifest
- missing attachment and missing thumbnail reporting

`GET /api/backups` lists saved archives. `GET /api/backups/:filename/download` downloads one saved archive.

## Directory Check

Run this after deployment and whenever Hostinger file permissions change:

```bash
npm run verify:data
```

It confirms both `ATTACHMENT_ROOT` and `BACKUP_ROOT` exist and are writable by the Node app.

## Restore Drill

Do this periodically before you truly need it:

1. Download the newest `.tar.gz` backup.
2. Extract it locally.
3. Confirm `manifest.json` opens.
4. Confirm note files are readable.
5. Confirm at least one attachment file opens when attachments exist.
6. Compare `manifest.json.summary.counts` with the Backup Check counts in the app.

The app does not yet offer one-click destructive restore. Treat restore as a manual process: use phpMyAdmin for database recovery and copy attachment files back into `uploads` only after confirming the backup contents.
