import { query } from "./db.js";

function normalizeTagName(value) {
  return String(value || "")
    .trim()
    .replace(/^#/, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export function normalizeTags(tags = []) {
  const source = Array.isArray(tags) ? tags : String(tags).split(",");
  return [...new Set(source.map(normalizeTagName).filter(Boolean))].slice(0, 20);
}

export async function listTags({ userId }) {
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

export async function ensureTags({ userId, tags }) {
  const names = normalizeTags(tags);

  for (const name of names) {
    await query(
      `INSERT IGNORE INTO tags (user_id, name)
       VALUES (:userId, :name)`,
      { userId, name }
    );
  }

  if (!names.length) {
    return [];
  }

  return query(
    `SELECT id, name
     FROM tags
     WHERE user_id = :userId
       AND name IN (${names.map((_, index) => `:tag${index}`).join(", ")})
     ORDER BY name ASC`,
    Object.fromEntries([
      ["userId", userId],
      ...names.map((name, index) => [`tag${index}`, name])
    ])
  );
}

export async function setNoteTags({ userId, noteId, tags }) {
  const tagRows = await ensureTags({ userId, tags });

  await query(
    `DELETE nt
     FROM note_tags nt
     JOIN notes n ON n.id = nt.note_id
     WHERE nt.note_id = :noteId
       AND n.user_id = :userId`,
    { userId, noteId }
  );

  for (const tag of tagRows) {
    await query(
      `INSERT IGNORE INTO note_tags (note_id, tag_id)
       VALUES (:noteId, :tagId)`,
      { noteId, tagId: tag.id }
    );
  }
}
