import { query } from "./db.js";
import { recordSyncChange } from "./syncRepository.js";

function mapNotebook(row) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    noteCount: row.noteCount || 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function listNotebooks({ userId }) {
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
     WHERE nb.user_id = :userId
       AND nb.deleted_at IS NULL
     GROUP BY nb.id, nb.name, nb.sort_order, nb.created_at, nb.updated_at
     ORDER BY nb.sort_order ASC, nb.name ASC`,
    { userId }
  );

  return rows.map(mapNotebook);
}

export async function createNotebook({ userId, input }) {
  const name = String(input.name || "").trim();
  if (!name) {
    const error = new Error("Notebook name is required.");
    error.status = 400;
    throw error;
  }

  const result = await query(
    `INSERT INTO notebooks (user_id, name, sort_order)
     VALUES (:userId, :name, :sortOrder)`,
    {
      userId,
      name,
      sortOrder: Number(input.sortOrder || 100)
    }
  );

  await recordSyncChange({
    userId,
    entityType: "notebook",
    entityId: result.insertId,
    action: "create"
  });

  return listNotebooks({ userId });
}

export async function renameNotebook({ userId, notebookId, name }) {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    const error = new Error("Notebook name is required.");
    error.status = 400;
    throw error;
  }

  const result = await query(
    `UPDATE notebooks
     SET name = :name
     WHERE id = :notebookId
       AND user_id = :userId
       AND deleted_at IS NULL`,
    { userId, notebookId, name: trimmed }
  );

  if (!result.affectedRows) {
    const error = new Error("Notebook not found.");
    error.status = 404;
    throw error;
  }

  await recordSyncChange({
    userId,
    entityType: "notebook",
    entityId: notebookId,
    action: "update"
  });

  return listNotebooks({ userId });
}

export async function deleteNotebook({ userId, notebookId }) {
  // Unlink notes from this notebook before soft-deleting it
  await query(
    `UPDATE notes
     SET notebook_id = NULL
     WHERE notebook_id = :notebookId
       AND user_id = :userId
       AND deleted_at IS NULL`,
    { userId, notebookId }
  );

  const result = await query(
    `UPDATE notebooks
     SET deleted_at = CURRENT_TIMESTAMP
     WHERE id = :notebookId
       AND user_id = :userId
       AND deleted_at IS NULL`,
    { userId, notebookId }
  );

  if (!result.affectedRows) {
    const error = new Error("Notebook not found.");
    error.status = 404;
    throw error;
  }

  await recordSyncChange({
    userId,
    entityType: "notebook",
    entityId: notebookId,
    action: "delete"
  });

  return listNotebooks({ userId });
}
