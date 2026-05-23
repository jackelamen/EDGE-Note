import { query } from "./db.js";
import { recordSyncChange } from "./syncRepository.js";

function mapNotebook(row) {
  return {
    id: row.id,
    parentId: row.parentId || null,
    name: row.name,
    icon: row.icon || null,
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
       nb.parent_id AS parentId,
       nb.name,
       nb.icon,
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
     GROUP BY nb.id, nb.parent_id, nb.name, nb.icon, nb.sort_order, nb.created_at, nb.updated_at
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

  const parentId = input.parentId ? Number(input.parentId) : null;
  const icon = input.icon ? String(input.icon).slice(0, 10) : null;

  const result = await query(
    `INSERT INTO notebooks (user_id, parent_id, name, icon, sort_order)
     VALUES (:userId, :parentId, :name, :icon, :sortOrder)`,
    {
      userId,
      parentId,
      name,
      icon,
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

export async function updateNotebook({ userId, notebookId, input }) {
  const fields = [];
  const params = { userId, notebookId };

  if (input.name !== undefined) {
    const trimmed = String(input.name || "").trim();
    if (!trimmed) {
      const error = new Error("Notebook name is required.");
      error.status = 400;
      throw error;
    }
    fields.push("name = :name");
    params.name = trimmed;
  }

  if (input.icon !== undefined) {
    fields.push("icon = :icon");
    params.icon = input.icon ? String(input.icon).slice(0, 10) : null;
  }

  if (input.parentId !== undefined) {
    fields.push("parent_id = :parentId");
    params.parentId = input.parentId ? Number(input.parentId) : null;
  }

  if (!fields.length) {
    return listNotebooks({ userId });
  }

  const result = await query(
    `UPDATE notebooks
     SET ${fields.join(", ")}
     WHERE id = :notebookId
       AND user_id = :userId
       AND deleted_at IS NULL`,
    params
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

// Keep old rename export for backwards compat
export async function renameNotebook({ userId, notebookId, name }) {
  return updateNotebook({ userId, notebookId, input: { name } });
}

export async function deleteNotebook({ userId, notebookId }) {
  // Re-parent child notebooks to this notebook's parent before deleting
  const [notebook] = await query(
    `SELECT parent_id FROM notebooks WHERE id = :notebookId AND user_id = :userId AND deleted_at IS NULL`,
    { notebookId, userId }
  );

  if (notebook) {
    await query(
      `UPDATE notebooks SET parent_id = :parentId WHERE parent_id = :notebookId AND user_id = :userId AND deleted_at IS NULL`,
      { parentId: notebook.parent_id ?? null, notebookId, userId }
    );
  }

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
