import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";
import { query } from "./db.js";
import { recordSyncChange } from "./syncRepository.js";

function cleanFilename(value) {
  return String(value || "attachment")
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 160) || "attachment";
}

function mapAttachment(row) {
  const downloadUrl = `/api/attachments/${row.id}/download`;
  const isImage = String(row.mimeType || "").startsWith("image/");

  return {
    id: row.id,
    noteId: row.noteId,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    checksum: row.checksum,
    downloadUrl,
    thumbnailUrl: isImage ? downloadUrl : null,
    createdAt: row.createdAt
  };
}

async function assertNoteAccess({ userId, noteId }) {
  const rows = await query(
    `SELECT id
     FROM notes
     WHERE user_id = :userId
       AND id = :noteId
       AND deleted_at IS NULL
     LIMIT 1`,
    { userId, noteId }
  );

  if (!rows.length) {
    const error = new Error("Note not found.");
    error.status = 404;
    throw error;
  }
}

export async function listAttachments({ userId, noteId }) {
  await assertNoteAccess({ userId, noteId });
  const rows = await query(
    `SELECT
       a.id,
       a.note_id AS noteId,
       a.filename,
       a.mime_type AS mimeType,
       a.size_bytes AS sizeBytes,
       a.checksum,
       a.created_at AS createdAt
     FROM attachments a
     JOIN notes n ON n.id = a.note_id
     WHERE n.user_id = :userId
       AND a.note_id = :noteId
       AND n.deleted_at IS NULL
     ORDER BY a.created_at DESC`,
    { userId, noteId }
  );

  return rows.map(mapAttachment);
}

export async function saveAttachment({ userId, noteId, file }) {
  await assertNoteAccess({ userId, noteId });

  if (!file?.buffer?.length) {
    const error = new Error("Attachment file is required.");
    error.status = 400;
    throw error;
  }

  const checksum = createHash("sha256").update(file.buffer).digest("hex");
  const filename = cleanFilename(file.filename);
  const noteDir = join(config.attachments.root, String(noteId));
  const storageName = `${checksum.slice(0, 16)}-${filename}`;
  const storagePath = join(String(noteId), storageName);

  await mkdir(noteDir, { recursive: true });
  await writeFile(join(config.attachments.root, storagePath), file.buffer);

  const result = await query(
    `INSERT INTO attachments
       (note_id, filename, mime_type, size_bytes, storage_path, checksum)
     VALUES
       (:noteId, :filename, :mimeType, :sizeBytes, :storagePath, :checksum)`,
    {
      noteId,
      filename,
      mimeType: file.mimeType,
      sizeBytes: file.buffer.length,
      storagePath,
      checksum
    }
  );

  await recordSyncChange({
    userId,
    entityType: "attachment",
    entityId: result.insertId,
    action: "create"
  });

  return getAttachment({ userId, attachmentId: result.insertId });
}

export async function getAttachment({ userId, attachmentId }) {
  const rows = await query(
    `SELECT
       a.id,
       a.note_id AS noteId,
       a.filename,
       a.mime_type AS mimeType,
       a.size_bytes AS sizeBytes,
       a.storage_path AS storagePath,
       a.checksum,
       a.created_at AS createdAt
     FROM attachments a
     JOIN notes n ON n.id = a.note_id
     WHERE n.user_id = :userId
       AND a.id = :attachmentId
       AND n.deleted_at IS NULL
     LIMIT 1`,
    { userId, attachmentId }
  );

  const row = rows[0];
  if (!row) return null;

  return {
    ...mapAttachment(row),
    storagePath: row.storagePath,
    stream: () => createReadStream(join(config.attachments.root, row.storagePath))
  };
}
