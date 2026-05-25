import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";
import { query } from "./db.js";
import { recordSyncChange } from "./syncRepository.js";

const thumbnailMaxBytes = 320 * 1024;

function cleanFilename(value) {
  return String(value || "attachment")
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 160) || "attachment";
}

function thumbnailExtension(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "img";
}

function inferMimeType(filename, mimeType = "") {
  const cleanMime = String(mimeType || "").trim().toLowerCase();
  if (cleanMime && cleanMime !== "application/octet-stream") return cleanMime;

  const name = String(filename || "").toLowerCase();
  if (name.endsWith(".avif")) return "image/avif";
  if (name.endsWith(".bmp")) return "image/bmp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".svg")) return "image/svg+xml";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".pdf")) return "application/pdf";
  return cleanMime || "application/octet-stream";
}

function mapAttachment(row) {
  const downloadUrl = `/api/attachments/${row.id}/download`;
  const mimeType = inferMimeType(row.filename, row.mimeType);

  return {
    id: row.id,
    noteId: row.noteId,
    filename: row.filename,
    mimeType,
    sizeBytes: row.sizeBytes,
    checksum: row.checksum,
    downloadUrl,
    thumbnailUrl: row.thumbnailPath ? `/api/attachments/${row.id}/thumbnail` : null,
    thumbnailMimeType: row.thumbnailMimeType || null,
    thumbnailSizeBytes: row.thumbnailSizeBytes || null,
    createdAt: row.createdAt
  };
}

async function writeThumbnail({ noteId, checksum, thumbnail }) {
  if (!thumbnail?.buffer?.length) return null;
  if (!String(thumbnail.mimeType || "").startsWith("image/")) return null;
  if (thumbnail.buffer.length > thumbnailMaxBytes) return null;

  const noteDir = join(config.attachments.root, String(noteId));
  const extension = thumbnailExtension(thumbnail.mimeType);
  const thumbnailPath = join(String(noteId), `${checksum.slice(0, 16)}-thumb.${extension}`);

  await mkdir(noteDir, { recursive: true });
  await writeFile(join(config.attachments.root, thumbnailPath), thumbnail.buffer);

  return {
    thumbnailPath,
    thumbnailMimeType: thumbnail.mimeType,
    thumbnailSizeBytes: thumbnail.buffer.length
  };
}

function assertAttachmentSize(file) {
  if (file.buffer.length > config.attachments.limitMb * 1024 * 1024) {
    const error = new Error("Attachment is too large.");
    error.status = 413;
    throw error;
  }
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
  let rows;
  try {
    rows = await query(
      `SELECT
         a.id,
         a.note_id AS noteId,
         a.filename,
         a.mime_type AS mimeType,
         a.size_bytes AS sizeBytes,
         a.thumbnail_path AS thumbnailPath,
         a.thumbnail_mime_type AS thumbnailMimeType,
         a.thumbnail_size_bytes AS thumbnailSizeBytes,
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
  } catch {
    // Fall back without thumbnail columns (schema pre-migration 0010)
    rows = await query(
      `SELECT
         a.id,
         a.note_id AS noteId,
         a.filename,
         a.mime_type AS mimeType,
         a.size_bytes AS sizeBytes,
         NULL AS thumbnailPath,
         NULL AS thumbnailMimeType,
         NULL AS thumbnailSizeBytes,
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
  }

  return rows.map(mapAttachment);
}

export async function saveAttachment({ userId, noteId, file, thumbnail = null }) {
  await assertNoteAccess({ userId, noteId });

  if (!file?.buffer?.length) {
    const error = new Error("Attachment file is required.");
    error.status = 400;
    throw error;
  }
  assertAttachmentSize(file);

  const checksum = createHash("sha256").update(file.buffer).digest("hex");
  const filename = cleanFilename(file.filename);
  const mimeType = inferMimeType(filename, file.mimeType);
  const noteDir = join(config.attachments.root, String(noteId));
  const storageName = `${checksum.slice(0, 16)}-${filename}`;
  const storagePath = join(String(noteId), storageName);

  await mkdir(noteDir, { recursive: true });
  await writeFile(join(config.attachments.root, storagePath), file.buffer);
  const thumbnailMeta = await writeThumbnail({ noteId, checksum, thumbnail });

  let result;
  try {
    result = await query(
      `INSERT INTO attachments
         (note_id, filename, mime_type, size_bytes, storage_path, thumbnail_path, thumbnail_mime_type, thumbnail_size_bytes, checksum)
       VALUES
         (:noteId, :filename, :mimeType, :sizeBytes, :storagePath, :thumbnailPath, :thumbnailMimeType, :thumbnailSizeBytes, :checksum)`,
      {
        noteId,
        filename,
        mimeType,
        sizeBytes: file.buffer.length,
        storagePath,
        thumbnailPath: thumbnailMeta?.thumbnailPath || null,
        thumbnailMimeType: thumbnailMeta?.thumbnailMimeType || null,
        thumbnailSizeBytes: thumbnailMeta?.thumbnailSizeBytes || null,
        checksum
      }
    );
  } catch (err) {
    // Fall back to INSERT without thumbnail columns (schema pre-migration 0010)
    if (!String(err.message).includes("thumbnail")) throw err;
    result = await query(
      `INSERT INTO attachments
         (note_id, filename, mime_type, size_bytes, storage_path, checksum)
       VALUES
         (:noteId, :filename, :mimeType, :sizeBytes, :storagePath, :checksum)`,
      { noteId, filename, mimeType, sizeBytes: file.buffer.length, storagePath, checksum }
    );
  }

  await recordSyncChange({
    userId,
    entityType: "attachment",
    entityId: result.insertId,
    action: "create"
  });

  return getAttachment({ userId, attachmentId: result.insertId });
}

export async function getAttachment({ userId, attachmentId }) {
  let rows;
  try {
    rows = await query(
      `SELECT
         a.id,
         a.note_id AS noteId,
         a.filename,
         a.mime_type AS mimeType,
         a.size_bytes AS sizeBytes,
         a.storage_path AS storagePath,
         a.thumbnail_path AS thumbnailPath,
         a.thumbnail_mime_type AS thumbnailMimeType,
         a.thumbnail_size_bytes AS thumbnailSizeBytes,
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
  } catch {
    // Fall back without thumbnail columns (schema pre-migration 0010)
    rows = await query(
      `SELECT
         a.id,
         a.note_id AS noteId,
         a.filename,
         a.mime_type AS mimeType,
         a.size_bytes AS sizeBytes,
         a.storage_path AS storagePath,
         NULL AS thumbnailPath,
         NULL AS thumbnailMimeType,
         NULL AS thumbnailSizeBytes,
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
  }

  const row = rows[0];
  if (!row) return null;

  return {
    ...mapAttachment(row),
    storagePath: row.storagePath,
    thumbnailPath: row.thumbnailPath,
    thumbnailStream: () => createReadStream(join(config.attachments.root, row.thumbnailPath)),
    stream: () => createReadStream(join(config.attachments.root, row.storagePath))
  };
}

export async function getAttachmentThumbnail({ userId, attachmentId }) {
  const attachment = await getAttachment({ userId, attachmentId });
  if (!attachment?.thumbnailPath) return null;
  return attachment;
}

export async function deleteAttachment({ userId, attachmentId }) {
  const attachment = await getAttachment({ userId, attachmentId });
  if (!attachment) return false;

  await query(
    `DELETE a
     FROM attachments a
     JOIN notes n ON n.id = a.note_id
     WHERE n.user_id = :userId
       AND a.id = :attachmentId`,
    { userId, attachmentId }
  );
  await unlink(join(config.attachments.root, attachment.storagePath)).catch(() => {});
  if (attachment.thumbnailPath) {
    await unlink(join(config.attachments.root, attachment.thumbnailPath)).catch(() => {});
  }
  await recordSyncChange({
    userId,
    entityType: "attachment",
    entityId: attachmentId,
    action: "delete"
  });

  return true;
}

export async function replaceAttachment({ userId, attachmentId, file, thumbnail = null }) {
  const existing = await getAttachment({ userId, attachmentId });
  if (!existing) return null;
  if (!file?.buffer?.length) {
    const error = new Error("Replacement file is required.");
    error.status = 400;
    throw error;
  }
  assertAttachmentSize(file);

  const checksum = createHash("sha256").update(file.buffer).digest("hex");
  const filename = cleanFilename(file.filename);
  const mimeType = inferMimeType(filename, file.mimeType);
  const noteDir = join(config.attachments.root, String(existing.noteId));
  const storageName = `${checksum.slice(0, 16)}-${filename}`;
  const storagePath = join(String(existing.noteId), storageName);

  await mkdir(noteDir, { recursive: true });
  await writeFile(join(config.attachments.root, storagePath), file.buffer);
  const thumbnailMeta = await writeThumbnail({ noteId: existing.noteId, checksum, thumbnail });
  try {
    await query(
      `UPDATE attachments a
       JOIN notes n ON n.id = a.note_id
       SET a.filename = :filename,
           a.mime_type = :mimeType,
           a.size_bytes = :sizeBytes,
           a.storage_path = :storagePath,
           a.thumbnail_path = :thumbnailPath,
           a.thumbnail_mime_type = :thumbnailMimeType,
           a.thumbnail_size_bytes = :thumbnailSizeBytes,
           a.checksum = :checksum
       WHERE n.user_id = :userId
         AND a.id = :attachmentId`,
      {
        userId,
        attachmentId,
        filename,
        mimeType,
        sizeBytes: file.buffer.length,
        storagePath,
        thumbnailPath: thumbnailMeta?.thumbnailPath || null,
        thumbnailMimeType: thumbnailMeta?.thumbnailMimeType || null,
        thumbnailSizeBytes: thumbnailMeta?.thumbnailSizeBytes || null,
        checksum
      }
    );
  } catch (err) {
    // Fall back to UPDATE without thumbnail columns (schema pre-migration 0010)
    if (!String(err.message).includes("thumbnail")) throw err;
    await query(
      `UPDATE attachments a
       JOIN notes n ON n.id = a.note_id
       SET a.filename = :filename,
           a.mime_type = :mimeType,
           a.size_bytes = :sizeBytes,
           a.storage_path = :storagePath,
           a.checksum = :checksum
       WHERE n.user_id = :userId
         AND a.id = :attachmentId`,
      { userId, attachmentId, filename, mimeType, sizeBytes: file.buffer.length, storagePath, checksum }
    );
  }
  await unlink(join(config.attachments.root, existing.storagePath)).catch(() => {});
  if (existing.thumbnailPath) {
    await unlink(join(config.attachments.root, existing.thumbnailPath)).catch(() => {});
  }
  await recordSyncChange({
    userId,
    entityType: "attachment",
    entityId: attachmentId,
    action: "update"
  });

  return getAttachment({ userId, attachmentId });
}

export async function listAllAttachments({ userId }) {
  const rows = await query(
    `SELECT
       a.id,
       a.note_id AS noteId,
       a.filename,
       a.mime_type AS mimeType,
       a.size_bytes AS sizeBytes,
       a.storage_path AS storagePath,
       a.thumbnail_path AS thumbnailPath,
       a.thumbnail_mime_type AS thumbnailMimeType,
       a.thumbnail_size_bytes AS thumbnailSizeBytes,
       a.checksum,
       a.created_at AS createdAt
     FROM attachments a
     JOIN notes n ON n.id = a.note_id
     WHERE n.user_id = :userId
       AND n.deleted_at IS NULL
     ORDER BY a.note_id ASC, a.created_at ASC`,
    { userId }
  );

  return rows.map((row) => ({
    ...mapAttachment(row),
    storagePath: row.storagePath,
    thumbnailPath: row.thumbnailPath,
    absolutePath: join(config.attachments.root, row.storagePath),
    thumbnailAbsolutePath: row.thumbnailPath ? join(config.attachments.root, row.thumbnailPath) : null
  }));
}
