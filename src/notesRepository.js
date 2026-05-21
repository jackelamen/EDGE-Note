import { query } from "./db.js";
import { recordSyncChange } from "./syncRepository.js";
import { normalizeTags, setNoteTags } from "./tagsRepository.js";

const listSelect = `
  SELECT
    n.id,
    n.notebook_id AS notebookId,
    nb.name AS notebookName,
    n.title,
    n.body,
    n.body_format AS bodyFormat,
    n.favorite,
    n.sync_version AS syncVersion,
    n.created_at AS createdAt,
    n.updated_at AS updatedAt,
    n.archived_at AS archivedAt,
    COALESCE(ts.tagsCsv, '') AS tagsCsv
  FROM notes n
  LEFT JOIN notebooks nb ON nb.id = n.notebook_id
  LEFT JOIN (
    SELECT
      nt.note_id,
      GROUP_CONCAT(t.name ORDER BY t.name SEPARATOR ',') AS tagsCsv
    FROM note_tags nt
    JOIN tags t ON t.id = nt.tag_id
    GROUP BY nt.note_id
  ) ts ON ts.note_id = n.id
`;

function mapNote(row) {
  return {
    id: row.id,
    notebookId: row.notebookId,
    notebookName: row.notebookName,
    title: row.title,
    body: row.body,
    bodyFormat: row.bodyFormat,
    favorite: Boolean(row.favorite),
    syncVersion: row.syncVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
    tags: row.tagsCsv ? row.tagsCsv.split(",") : []
  };
}

function noteParams(userId, input) {
  return {
    userId,
    notebookId: input.notebookId || null,
    title: String(input.title || "").trim() || "Untitled note",
    body: String(input.body || ""),
    bodyFormat: input.bodyFormat || "markdown",
    favorite: input.favorite ? 1 : 0,
    tags: normalizeTags(input.tags)
  };
}

export async function listNotes({ userId, search = "", limit = 50 }) {
  const cleanLimit = Math.min(Math.max(Number(limit) || 50, 1), 1000);
  const term = String(search || "").trim();

  if (term) {
    return query(
      `${listSelect}
       WHERE n.user_id = :userId
         AND n.deleted_at IS NULL
         AND (n.title LIKE :likeTerm OR n.body LIKE :likeTerm OR ts.tagsCsv LIKE :likeTerm)
       ORDER BY n.updated_at DESC
       LIMIT ${cleanLimit}`,
      { userId, likeTerm: `%${term}%` }
    ).then((rows) => rows.map(mapNote));
  }

  return query(
    `${listSelect}
     WHERE n.user_id = :userId
       AND n.deleted_at IS NULL
     ORDER BY n.updated_at DESC
     LIMIT ${cleanLimit}`,
    { userId }
  ).then((rows) => rows.map(mapNote));
}

export async function getNote({ userId, noteId }) {
  const rows = await query(
    `${listSelect}
     WHERE n.user_id = :userId
       AND n.id = :noteId
       AND n.deleted_at IS NULL
     LIMIT 1`,
    { userId, noteId }
  );
  return rows[0] ? mapNote(rows[0]) : null;
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

  if (params.tags.length) {
    await setNoteTags({ userId, noteId: result.insertId, tags: params.tags });
  }

  const note = await getNote({ userId, noteId: result.insertId });
  await recordSyncChange({
    userId,
    entityType: "note",
    entityId: result.insertId,
    action: "create",
    syncVersion: note.syncVersion
  });

  return note;
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
    favorite: input.favorite ?? existing.favorite,
    tags: input.tags ?? existing.tags
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

  await setNoteTags({ userId, noteId, tags: params.tags });

  const note = await getNote({ userId, noteId });
  await recordSyncChange({
    userId,
    entityType: "note",
    entityId: noteId,
    action: "update",
    syncVersion: note.syncVersion
  });

  return note;
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

  const deleted = result.affectedRows > 0;
  if (deleted) {
    await recordSyncChange({
      userId,
      entityType: "note",
      entityId: noteId,
      action: "delete"
    });
  }

  return deleted;
}
