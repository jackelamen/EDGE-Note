import { query } from "./db.js";
import { recordSyncChange } from "./syncRepository.js";
import { normalizeTags, setNoteTags } from "./tagsRepository.js";

const relatedStopWords = new Set([
  "about",
  "after",
  "also",
  "because",
  "been",
  "before",
  "from",
  "have",
  "into",
  "note",
  "notes",
  "that",
  "their",
  "then",
  "there",
  "this",
  "with",
  "your"
]);

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

function mapVersion(row) {
  return {
    id: row.id,
    noteId: row.noteId,
    title: row.title,
    body: row.body,
    bodyFormat: row.bodyFormat,
    createdAt: row.createdAt
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

export async function listNotes({
  userId,
  search = "",
  limit = 50,
  notebookId = null,
  tag = "",
  favorite = false,
  tasks = false,
  archived = "active"
}) {
  const cleanLimit = Math.min(Math.max(Number(limit) || 50, 1), 1000);
  const term = String(search || "").trim();
  const cleanTag = String(tag || "").trim().replace(/^#/, "").toLowerCase();
  const params = {
    userId,
    likeTerm: `%${term}%`,
    notebookId: Number(notebookId) || null,
    tag: cleanTag,
    booleanTerm: term ? `${term.split(/\s+/).map((word) => `${word}*`).join(" ")}` : ""
  };
  const where = [
    "n.user_id = :userId",
    "n.deleted_at IS NULL"
  ];

  if (params.notebookId) {
    where.push("n.notebook_id = :notebookId");
  }

  if (cleanTag) {
    where.push("FIND_IN_SET(:tag, ts.tagsCsv)");
  }

  if (favorite) {
    where.push("n.favorite = 1");
  }

  if (tasks) {
    where.push("(n.body LIKE '%- [ ]%' OR n.body LIKE '%- [x]%' OR n.body LIKE '%- [X]%')");
  }

  if (archived === "only") {
    where.push("n.archived_at IS NOT NULL");
  } else if (archived === "active") {
    where.push("n.archived_at IS NULL");
  }

  if (term) {
    where.push("(n.title LIKE :likeTerm OR n.body LIKE :likeTerm OR ts.tagsCsv LIKE :likeTerm)");
  }
  const whereSql = where.join("\n       AND ");

  if (term) {
    return query(
      `${listSelect}
       WHERE ${whereSql}
       ORDER BY
         CASE
           WHEN n.title = :searchTerm THEN 100
           WHEN n.title LIKE :prefixTerm THEN 80
           WHEN n.title LIKE :likeTerm THEN 60
           WHEN ts.tagsCsv LIKE :likeTerm THEN 45
           WHEN n.body LIKE :likeTerm THEN 20
           ELSE 0
         END DESC,
         MATCH(n.title, n.body) AGAINST(:booleanTerm IN BOOLEAN MODE) DESC,
         n.updated_at DESC
       LIMIT ${cleanLimit}`,
      {
        ...params,
        searchTerm: term,
        prefixTerm: `${term}%`
      }
    ).then((rows) => rows.map(mapNote));
  }

  return query(
    `${listSelect}
     WHERE ${whereSql}
     ORDER BY n.updated_at DESC
     LIMIT ${cleanLimit}`,
    params
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

export async function findRelatedNotes({ userId, noteId, limit = 6 }) {
  const note = await getNote({ userId, noteId });
  if (!note) return [];

  const cleanLimit = Math.min(Math.max(Number(limit) || 6, 1), 12);
  const tagTerms = (note.tags || []).map((tag) => `#${tag}`).join(" ");
  const words = `${note.title || ""} ${tagTerms} ${note.body || ""}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !relatedStopWords.has(word))
    .filter((word, index, allWords) => allWords.indexOf(word) === index)
    .slice(0, 12);

  if (!words.length) return [];

  return query(
    `${listSelect}
     WHERE n.user_id = :userId
       AND n.id <> :noteId
       AND n.deleted_at IS NULL
       AND n.archived_at IS NULL
       AND (
         ${words.map((_, index) => `(n.title LIKE :term${index} OR n.body LIKE :term${index} OR ts.tagsCsv LIKE :term${index})`).join(" OR ")}
       )
     ORDER BY
       ${words.map((_, index) => `(CASE WHEN n.title LIKE :term${index} THEN 3 WHEN ts.tagsCsv LIKE :term${index} THEN 2 WHEN n.body LIKE :term${index} THEN 1 ELSE 0 END)`).join(" + ")} DESC,
       n.updated_at DESC
     LIMIT ${cleanLimit}`,
    Object.fromEntries([
      ["userId", userId],
      ["noteId", noteId],
      ...words.map((word, index) => [`term${index}`, `%${word}%`])
    ])
  ).then((rows) => rows.map(mapNote));
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
    notebookId: Object.prototype.hasOwnProperty.call(input, "notebookId")
      ? input.notebookId
      : existing.notebookId,
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

export async function setNoteArchived({ userId, noteId, archived }) {
  const result = await query(
    `UPDATE notes
     SET archived_at = ${archived ? "CURRENT_TIMESTAMP" : "NULL"},
         sync_version = sync_version + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = :userId
       AND id = :noteId
       AND deleted_at IS NULL`,
    { userId, noteId }
  );

  if (!result.affectedRows) {
    return null;
  }

  const note = await getNote({ userId, noteId });
  await recordSyncChange({
    userId,
    entityType: "note",
    entityId: noteId,
    action: archived ? "archive" : "restore",
    syncVersion: note.syncVersion
  });

  return note;
}

export async function listNoteVersions({ userId, noteId, limit = 20 }) {
  const cleanLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const versions = await query(
    `SELECT
       nv.id,
       nv.note_id AS noteId,
       nv.title,
       nv.body,
       nv.body_format AS bodyFormat,
       nv.created_at AS createdAt
     FROM note_versions nv
     JOIN notes n ON n.id = nv.note_id
     WHERE n.user_id = :userId
       AND n.id = :noteId
       AND n.deleted_at IS NULL
     ORDER BY nv.created_at DESC, nv.id DESC
     LIMIT ${cleanLimit}`,
    { userId, noteId }
  );

  return versions.map(mapVersion);
}

export async function restoreNoteVersion({ userId, noteId, versionId }) {
  const existing = await getNote({ userId, noteId });
  if (!existing) {
    return null;
  }

  const versions = await query(
    `SELECT
       nv.id,
       nv.note_id AS noteId,
       nv.title,
       nv.body,
       nv.body_format AS bodyFormat,
       nv.created_at AS createdAt
     FROM note_versions nv
     JOIN notes n ON n.id = nv.note_id
     WHERE n.user_id = :userId
       AND n.id = :noteId
       AND nv.id = :versionId
       AND n.deleted_at IS NULL
     LIMIT 1`,
    { userId, noteId, versionId }
  );
  const version = versions[0] ? mapVersion(versions[0]) : null;
  if (!version) {
    return null;
  }

  return updateNote({
    userId,
    noteId,
    input: {
      notebookId: existing.notebookId,
      title: version.title,
      body: version.body,
      bodyFormat: version.bodyFormat,
      favorite: existing.favorite,
      tags: existing.tags
    }
  });
}
