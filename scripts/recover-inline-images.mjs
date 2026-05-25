/**
 * recover-inline-images.mjs
 *
 * Finds image attachments whose /api/attachments/{id}/download URL is missing
 * from their note's body, and appends an <img> tag back into the body.
 *
 * Safe to run multiple times — it checks before patching.
 *
 * Usage (from the project root):
 *   node scripts/recover-inline-images.mjs [--dry-run]
 */

import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Parse .env manually — no dotenv dependency needed
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envText = readFileSync(join(__dirname, "../.env"), "utf8");
  for (const line of envText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
} catch { /* no .env file — rely on environment variables */ }

const dryRun = process.argv.includes("--dry-run");
if (dryRun) console.log("DRY RUN — no changes will be written.\n");

const db = await mysql.createConnection({
  host:     process.env.MYSQL_HOST     || "localhost",
  port:     Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE || "edge_note",
  user:     process.env.MYSQL_USER     || "edge_note",
  password: process.env.MYSQL_PASSWORD || "",
});

// Image MIME types and extensions to recover
const IMAGE_MIME_RE = /^image\//i;
const IMAGE_EXT_RE  = /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i;

function isImage(mimeType, filename) {
  return IMAGE_MIME_RE.test(mimeType || "") || IMAGE_EXT_RE.test(filename || "");
}

// Fetch all image attachments joined with their note body
const [rows] = await db.execute(`
  SELECT
    a.id          AS attachmentId,
    a.note_id     AS noteId,
    a.filename,
    a.mime_type   AS mimeType,
    n.body,
    n.body_format AS bodyFormat
  FROM attachments a
  JOIN notes n ON n.id = a.note_id
  WHERE n.deleted_at IS NULL
  ORDER BY a.note_id ASC, a.created_at ASC
`);

// Group by note
const byNote = new Map();
for (const row of rows) {
  if (!isImage(row.mimeType, row.filename)) continue;
  if (!byNote.has(row.noteId)) byNote.set(row.noteId, { body: row.body, bodyFormat: row.bodyFormat, missing: [] });
  const entry = byNote.get(row.noteId);
  const url = `/api/attachments/${row.attachmentId}/download`;
  if (!entry.body || !entry.body.includes(url)) {
    entry.missing.push({ attachmentId: row.attachmentId, filename: row.filename, url });
  }
}

let recovered = 0;
let skipped   = 0;

for (const [noteId, { body, bodyFormat, missing }] of byNote) {
  if (!missing.length) { skipped++; continue; }

  console.log(`Note ${noteId}: re-inserting ${missing.length} image(s):`);
  missing.forEach((m) => console.log(`  • [${m.attachmentId}] ${m.filename}`));

  // Build the img tags to append
  const imgTags = missing.map(
    (m) => `<p><img src="${m.url}" alt="${m.filename.replace(/"/g, "&quot;")}" class="note-img"></p>`
  ).join("\n");

  const newBody = (body || "") + "\n" + imgTags;

  if (!dryRun) {
    await db.execute(
      `UPDATE notes SET body = ?, body_format = 'html', updated_at = updated_at WHERE id = ?`,
      [newBody, noteId]
    );
  }
  recovered++;
}

await db.end();

console.log(`\nDone. ${recovered} note(s) recovered, ${skipped} note(s) already had their images.`);
if (dryRun) console.log("(Dry run — run without --dry-run to apply changes.)");
