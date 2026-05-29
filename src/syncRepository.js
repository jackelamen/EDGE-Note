import { query } from "./db.js";

function cleanLimit(value, fallback, max) {
  return Math.min(Math.max(Number(value) || fallback, 1), max);
}

export async function recordSyncChange({ userId, entityType, entityId, action, syncVersion = 1 }) {
  await query(
    `INSERT INTO sync_changes
       (user_id, entity_type, entity_id, action, sync_version)
     VALUES
       (:userId, :entityType, :entityId, :action, :syncVersion)`,
    { userId, entityType, entityId, action, syncVersion }
  );
}

export async function latestSyncCursor({ userId }) {
  const rows = await query(
    `SELECT COALESCE(MAX(id), 0) AS cursor
     FROM sync_changes
     WHERE user_id = :userId`,
    { userId }
  );
  return Number(rows[0]?.cursor) || 0;
}

async function syncNotes({ userId, ids = [] } = {}) {
  const params = { userId };
  const idFilter = ids.length
    ? `AND n.id IN (${ids.map((id, index) => {
      params[`note${index}`] = id;
      return `:note${index}`;
    }).join(", ")})`
    : "";

  const rows = await query(
    `SELECT
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
     WHERE n.user_id = :userId
       AND n.deleted_at IS NULL
       AND n.archived_at IS NULL
       ${idFilter}
     ORDER BY n.updated_at DESC`,
    params
  );

  return rows.map((row) => ({
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
  }));
}

async function syncNotebooks({ userId, ids = [] } = {}) {
  const params = { userId };
  const idFilter = ids.length
    ? `AND nb.id IN (${ids.map((id, index) => {
      params[`notebook${index}`] = id;
      return `:notebook${index}`;
    }).join(", ")})`
    : "";

  const rows = await query(
    `SELECT
       nb.id,
       nb.name,
       nb.sort_order AS sortOrder,
       nb.created_at AS createdAt,
       nb.updated_at AS updatedAt,
       COUNT(n.id) AS noteCount
     FROM notebooks nb
     LEFT JOIN notes n
       ON n.notebook_id = nb.id
      AND n.deleted_at IS NULL
      AND n.archived_at IS NULL
     WHERE nb.user_id = :userId
       AND nb.deleted_at IS NULL
       ${idFilter}
     GROUP BY nb.id, nb.name, nb.sort_order, nb.created_at, nb.updated_at
     ORDER BY nb.sort_order ASC, nb.name ASC`,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    noteCount: Number(row.noteCount) || 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

async function syncTags({ userId }) {
  const rows = await query(
    `SELECT
       t.id,
       t.name,
       t.created_at AS createdAt,
       COUNT(n.id) AS noteCount
     FROM tags t
     LEFT JOIN note_tags nt ON nt.tag_id = t.id
     LEFT JOIN notes n
       ON n.id = nt.note_id
      AND n.user_id = t.user_id
      AND n.deleted_at IS NULL
      AND n.archived_at IS NULL
     WHERE t.user_id = :userId
     GROUP BY t.id, t.name, t.created_at
     ORDER BY t.name ASC`,
    { userId }
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    noteCount: Number(row.noteCount) || 0,
    createdAt: row.createdAt
  }));
}

async function syncAttachments({ userId, ids = [] } = {}) {
  const params = { userId };
  const idFilter = ids.length
    ? `AND a.id IN (${ids.map((id, index) => {
      params[`attachment${index}`] = id;
      return `:attachment${index}`;
    }).join(", ")})`
    : "";

  const rows = await query(
    `SELECT
       a.id,
       a.note_id AS noteId,
       a.filename,
       a.mime_type AS mimeType,
       a.size_bytes AS sizeBytes,
       a.checksum,
       a.thumbnail_path AS thumbnailPath,
       a.thumbnail_mime_type AS thumbnailMimeType,
       a.thumbnail_size_bytes AS thumbnailSizeBytes,
       a.created_at AS createdAt
     FROM attachments a
     JOIN notes n ON n.id = a.note_id
     WHERE n.user_id = :userId
       AND n.deleted_at IS NULL
       ${idFilter}
     ORDER BY a.note_id ASC, a.created_at ASC`,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    noteId: row.noteId,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    checksum: row.checksum,
    downloadUrl: `/api/attachments/${row.id}/download`,
    thumbnailUrl: row.thumbnailPath ? `/api/attachments/${row.id}/thumbnail` : null,
    thumbnailMimeType: row.thumbnailMimeType || null,
    thumbnailSizeBytes: row.thumbnailSizeBytes || null,
    createdAt: row.createdAt
  }));
}

function idsFor(changes, entityType) {
  return [...new Set(changes
    .filter((change) => change.entityType === entityType && change.action !== "delete")
    .map((change) => Number(change.entityId))
    .filter(Boolean))];
}

async function entityPayloads({ userId, changes }) {
  const [notes, notebooks, tags, attachments] = await Promise.all([
    syncNotes({ userId, ids: idsFor(changes, "note") }),
    syncNotebooks({ userId, ids: idsFor(changes, "notebook") }),
    syncTags({ userId }),
    syncAttachments({ userId, ids: idsFor(changes, "attachment") })
  ]);

  return { notes, notebooks, tags, attachments };
}

export async function buildSyncBootstrap({ userId, limit = 1000 }) {
  const [notes, notebooks, tags, attachments, cursor] = await Promise.all([
    syncNotes({ userId }).then((rows) => rows.slice(0, cleanLimit(limit, 1000, 1000))),
    syncNotebooks({ userId }),
    syncTags({ userId }),
    syncAttachments({ userId }),
    latestSyncCursor({ userId })
  ]);

  return {
    cursor,
    serverTime: new Date().toISOString(),
    entities: { notes, notebooks, tags, attachments }
  };
}

export async function pullSyncChanges({ userId, cursor = 0, limit = 100, includeEntities = false }) {
  const cleanPullLimit = cleanLimit(limit, 100, 250);
  const cleanCursor = Math.max(Number(cursor) || 0, 0);
  const rows = await query(
    `SELECT
       id AS cursor,
       entity_type AS entityType,
       entity_id AS entityId,
       action,
       sync_version AS syncVersion,
       created_at AS createdAt
     FROM sync_changes
     WHERE user_id = :userId
       AND id > :cursor
     ORDER BY id ASC
     LIMIT ${cleanPullLimit}`,
    { userId, cursor: cleanCursor }
  );

  const nextCursor = rows.length ? rows[rows.length - 1].cursor : cleanCursor;
  const payload = {
    changes: rows,
    nextCursor,
    hasMore: rows.length === cleanPullLimit,
    serverTime: new Date().toISOString()
  };

  if (includeEntities) {
    payload.entities = await entityPayloads({ userId, changes: rows });
  }

  return {
    ...payload
  };
}
