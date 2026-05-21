import { query } from "./db.js";

const listSelect = `
  SELECT
    id,
    notebook_id AS notebookId,
    title,
    body,
    body_format AS bodyFormat,
    favorite,
    sync_version AS syncVersion,
    created_at AS createdAt,
    updated_at AS updatedAt,
    archived_at AS archivedAt
  FROM notes
`;

function noteParams(userId, input) {
  return {
    userId,
    notebookId: input.notebookId || null,
    title: String(input.title || "").trim() || "Untitled note",
    body: String(input.body || ""),
    bodyFormat: input.bodyFormat || "markdown",
    favorite: input.favorite ? 1 : 0
  };
}

export async function listNotes({ userId, search = "", limit = 50 }) {
  const cleanLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const term = String(search || "").trim();

  if (term) {
    return query(
      `${listSelect}
       WHERE user_id = :userId
         AND deleted_at IS NULL
         AND (title LIKE :likeTerm OR body LIKE :likeTerm)
       ORDER BY updated_at DESC
       LIMIT ${cleanLimit}`,
      { userId, likeTerm: `%${term}%` }
    );
  }

  return query(
    `${listSelect}
     WHERE user_id = :userId
       AND deleted_at IS NULL
     ORDER BY updated_at DESC
     LIMIT ${cleanLimit}`,
    { userId }
  );
}

export async function getNote({ userId, noteId }) {
  const rows = await query(
    `${listSelect}
     WHERE user_id = :userId
       AND id = :noteId
       AND deleted_at IS NULL
     LIMIT 1`,
    { userId, noteId }
  );
  return rows[0] || null;
}

export async function createNote({ userId, input }) {
  const params = noteParams(userId, input);
  const result = await query(
    `INSERT INTO notes
       (user_id, notebook_id, title, body, body_format, favorite, sync_version)
     VALUES
       (:userId, :notebookId, :title, :body, :bodyFormat, :favorite, 1)`,
    params
  );

  return getNote({ userId, noteId: result.insertId });
}

export async function updateNote({ userId, noteId, input }) {
  const existing = await getNote({ userId, noteId });
  if (!existing) {
    return null;
  }

  await query(
    `INSERT INTO note_versions (note_id, title, body, body_format)
     VALUES (:noteId, :title, :body, :bodyFormat)`,
    {
      noteId,
      title: existing.title,
      body: existing.body,
      bodyFormat: existing.bodyFormat
    }
  );

  const params = noteParams(userId, {
    notebookId: input.notebookId ?? existing.notebookId,
    title: input.title ?? existing.title,
    body: input.body ?? existing.body,
    bodyFormat: input.bodyFormat ?? existing.bodyFormat,
    favorite: input.favorite ?? existing.favorite
  });

  await query(
    `UPDATE notes
     SET notebook_id = :notebookId,
         title = :title,
         body = :body,
         body_format = :bodyFormat,
         favorite = :favorite,
         sync_version = sync_version + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = :userId
       AND id = :noteId
       AND deleted_at IS NULL`,
    { ...params, noteId }
  );

  return getNote({ userId, noteId });
}

export async function deleteNote({ userId, noteId }) {
  const result = await query(
    `UPDATE notes
     SET deleted_at = CURRENT_TIMESTAMP,
         sync_version = sync_version + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = :userId
       AND id = :noteId
       AND deleted_at IS NULL`,
    { userId, noteId }
  );

  return result.affectedRows > 0;
}
