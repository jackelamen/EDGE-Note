# Hostinger Deployment Checklist

EDGE Note is designed for Hostinger Business Node hosting with MySQL as the source of truth.

## Runtime

1. Set Node.js to version 22.x.
2. Use `npm install --omit=dev`.
3. Use `npm start` as the start command.
4. Set `EDGE_NOTE_HOST=0.0.0.0`.
5. Set `EDGE_NOTE_ENV=production`.
6. Set `EDGE_NOTE_PUBLIC_URL` to the deployed domain or subdomain.

## Required Environment Variables

1. `EDGE_NOTE_OWNER_USER_ID=1`
2. `EDGE_NOTE_SESSION_SECRET=<long random secret>`
3. `MYSQL_HOST=<Hostinger MySQL host>`
4. `MYSQL_PORT=3306`
5. `MYSQL_DATABASE=<database name>`
6. `MYSQL_USER=<database user>`
7. `MYSQL_PASSWORD=<database password>`
8. `MYSQL_CONNECTION_LIMIT=5`
9. `ATTACHMENT_ROOT=./uploads`
10. `ATTACHMENT_LIMIT_MB=25`
11. `AI_ENDPOINT_URL=<optional OpenAI-compatible endpoint>`
12. `AI_MODEL_NAME=gemma`
13. `AI_API_KEY=<optional endpoint key>`

## Database

1. Create the MySQL database in Hostinger.
2. Import `database/schema.sql`.
3. Import `database/seed.sql`.
4. Confirm the owner user id matches `EDGE_NOTE_OWNER_USER_ID`.

## File Storage

1. Create the `uploads` directory.
2. Confirm the Node process can write to `uploads`.
3. Keep `uploads` out of Git.
4. Back up `uploads` together with MySQL exports.

## Deployment Smoke Test

1. Open `/api/health`.
2. Open the app root.
3. Set the owner password.
4. Create and save a note.
5. Upload and download a small attachment.
6. Export JSON.
7. Export Markdown.
8. Log out and log back in.
