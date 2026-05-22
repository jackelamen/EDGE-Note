# Hostinger Deployment Checklist

EDGE Note is designed for Hostinger Business Node hosting with MySQL as the source of truth and Hostinger file storage for early attachments.

## 1. Prepare The Repository

1. Confirm the latest `main` branch is pushed to `jackelamen/EDGE-Note`.
2. In Hostinger, create or select the Node.js app for the EDGE Note domain or subdomain.
3. Upload or deploy the repository contents.
4. Run `npm install --omit=dev`.
5. Set the start command to `npm start`.
6. Set Node.js to version `22.x`.

## 2. Production Environment

Set these values in Hostinger's Node app environment screen:

```bash
EDGE_NOTE_ENV=production
EDGE_NOTE_HOST=0.0.0.0
EDGE_NOTE_PORT=<Hostinger provided port if required, otherwise omit if PORT is provided>
EDGE_NOTE_PUBLIC_URL=https://your-edge-note-domain.example
EDGE_NOTE_OWNER_USER_ID=1
EDGE_NOTE_SESSION_SECRET=<long random secret, 32+ chars>

MYSQL_HOST=<Hostinger MySQL host or 127.0.0.1>
MYSQL_PORT=3306
MYSQL_DATABASE=<database name>
MYSQL_USER=<database user>
MYSQL_PASSWORD=<database password>
MYSQL_CONNECTION_LIMIT=5

ATTACHMENT_ROOT=./uploads
ATTACHMENT_LIMIT_MB=25

AI_ENDPOINT_URL=<optional OpenAI-compatible endpoint>
AI_MODEL_NAME=gemma
AI_API_KEY=<optional endpoint key>
```

Run this locally with the same values exported before deploying, or through the Hostinger terminal if available:

```bash
npm run verify:prod-env
```

Production hardening depends on `EDGE_NOTE_PUBLIC_URL` being the exact deployed HTTPS origin. Cookie-backed write requests are rejected when their `Origin` or `Referer` does not match that value.

## 3. MySQL Setup

1. Create the MySQL database in Hostinger.
2. Open phpMyAdmin for that database.
3. Import `database/schema.sql`.
4. Import `database/seed.sql`.
5. If the database already existed before Batch 10, import `database/migrations/0010_attachment_thumbnails.sql` once.
6. Confirm `users.id = 1` exists, unless you changed `EDGE_NOTE_OWNER_USER_ID`.
7. Confirm the database user has select, insert, update, delete, create, alter, and index permissions.

## 4. File Storage

1. Create the `uploads` directory at the deployed app root.
2. Confirm the Node app can write to `uploads`.
3. Keep `uploads` out of Git.
4. Include `uploads` in manual Hostinger backups.
5. Use `/api/export.tgz` for app-level backups that include attachment files.

## 5. First Login

1. Open the deployed app URL.
2. If the setup screen appears, set the owner password.
3. If the database setup screen appears, re-check the MySQL credentials and schema import.
4. Log out and log back in.
5. Use the Security panel to confirm password change works after first login.

## 6. Deployment Smoke Test

1. Open `/api/health` and confirm `ok: true`.
2. Open `/api/config` and confirm safe app settings render.
3. Confirm the `/api/health` response includes security headers such as `content-security-policy` and `x-frame-options`.
4. Create a notebook.
5. Create a note in that notebook.
6. Add tags and a checklist item.
7. Save the note.
8. Refresh and confirm the note reloads.
9. Favorite, archive, restore, and delete a test note.
10. Upload and download a small attachment.
11. Upload a small image and confirm it shows a thumbnail.
12. Save an edit twice, then restore a prior History version.
13. Run Backup Check and confirm it passes.
14. Export JSON.
15. Export Markdown.
16. Export Archive and confirm the `.tar.gz` downloads.
17. Change the password and log back in.

## 7. Rollback Plan

1. Keep the previous working deployment files until the new deployment passes the smoke test.
2. Before schema changes, export MySQL from phpMyAdmin.
3. Before attachment changes, copy the `uploads` directory.
4. If deployment fails, restore the previous app files and restart the Node app.
5. If database import fails, restore the prior MySQL export before trying again.

## 8. Known Constraints

- Do not run Gemma locally on Hostinger Business; use an external HTTP endpoint.
- Do not depend on WebSockets or background workers for the first version.
- Keep attachment sizes modest.
- Keep sync request batches small.
- Treat `/api/export.tgz` as a portable app backup, not a full infrastructure backup.
- Use polling and `/api/sync/pull`; do not add realtime sync until mobile usage proves it is needed.
- Keep `EDGE_NOTE_PUBLIC_URL` aligned with the deployed HTTPS domain; production write requests use it for origin protection.
