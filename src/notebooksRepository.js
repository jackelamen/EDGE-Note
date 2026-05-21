import { query } from "./db.js";

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

  await query(
    `INSERT INTO notebooks (user_id, name, sort_order)
     VALUES (:userId, :name, :sortOrder)`,
    {
      userId,
      name,
      sortOrder: Number(input.sortOrder || 100)
    }
  );

  return listNotebooks({ userId });
}
