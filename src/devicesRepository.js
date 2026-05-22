import { query } from "./db.js";

function mapDevice(row) {
  return {
    id: row.id,
    deviceKey: row.deviceKey,
    deviceName: row.deviceName,
    lastSyncCursor: row.lastSyncCursor,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function cleanDeviceName(value) {
  return String(value || "").trim().slice(0, 255) || "Unnamed device";
}

function cleanDeviceKey(value) {
  return String(value || "").trim().slice(0, 120) || null;
}

export async function listDevices({ userId }) {
  const rows = await query(
    `SELECT
       id,
       device_key AS deviceKey,
       device_name AS deviceName,
       last_sync_cursor AS lastSyncCursor,
       created_at AS createdAt,
       updated_at AS updatedAt
     FROM devices
     WHERE user_id = :userId
     ORDER BY updated_at DESC`,
    { userId }
  );

  return rows.map(mapDevice);
}

export async function registerDevice({ userId, input }) {
  const deviceName = cleanDeviceName(input.deviceName || input.name);
  const deviceKey = cleanDeviceKey(input.deviceKey || input.key);

  if (deviceKey) {
    await query(
      `INSERT INTO devices (user_id, device_key, device_name)
       VALUES (:userId, :deviceKey, :deviceName)
       ON DUPLICATE KEY UPDATE
         device_name = VALUES(device_name),
         updated_at = CURRENT_TIMESTAMP`,
      { userId, deviceKey, deviceName }
    );
  } else {
    await query(
      `INSERT INTO devices (user_id, device_name)
       VALUES (:userId, :deviceName)`,
      { userId, deviceName }
    );
  }

  const devices = await listDevices({ userId });
  return deviceKey ? devices.find((device) => device.deviceKey === deviceKey) : devices[0];
}

export async function updateDeviceCursor({ userId, deviceId, cursor }) {
  const cleanCursor = Math.max(Number(cursor) || 0, 0);
  const result = await query(
    `UPDATE devices
     SET last_sync_cursor = :cursor,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = :userId
       AND id = :deviceId`,
    { userId, deviceId, cursor: cleanCursor }
  );

  if (!result.affectedRows) return null;

  const rows = await query(
    `SELECT
       id,
       device_key AS deviceKey,
       device_name AS deviceName,
       last_sync_cursor AS lastSyncCursor,
       created_at AS createdAt,
       updated_at AS updatedAt
     FROM devices
     WHERE user_id = :userId
       AND id = :deviceId
     LIMIT 1`,
    { userId, deviceId }
  );

  return rows[0] ? mapDevice(rows[0]) : null;
}
