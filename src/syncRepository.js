import { query } from "./db.js";

export async function recordSyncChange({ userId, entityType, entityId, action, syncVersion = 1 }) {
  await query(
    `INSERT INTO sync_changes
       (user_id, entity_type, entity_id, action, sync_version)
     VALUES
       (:userId, :entityType, :entityId, :action, :syncVersion)`,
    { userId, entityType, entityId, action, syncVersion }
  );
}

export async function pullSyncChanges({ userId, cursor = 0, limit = 100 }) {
  const cleanLimit = Math.min(Math.max(Number(limit) || 100, 1), 250);
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
     LIMIT ${cleanLimit}`,
    { userId, cursor: Number(cursor) || 0 }
  );

  return {
    changes: rows,
    nextCursor: rows.length ? rows[rows.length - 1].cursor : Number(cursor) || 0,
    hasMore: rows.length === cleanLimit
  };
}
