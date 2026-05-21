import { config } from "./config.js";

let poolPromise;

async function createPool() {
  let mysql;
  try {
    mysql = await import("mysql2/promise");
  } catch {
    const error = new Error("Install dependencies with npm install before using MySQL-backed API routes.");
    error.code = "MYSQL_DRIVER_MISSING";
    throw error;
  }

  return mysql.createPool({
    ...config.database,
    waitForConnections: true,
    namedPlaceholders: true,
    timezone: "Z"
  });
}

export async function query(sql, params = {}) {
  if (!poolPromise) {
    poolPromise = createPool();
  }

  const pool = await poolPromise;
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export function isDatabaseError(error) {
  return Boolean(error?.code?.startsWith?.("MYSQL") || error?.errno || error?.sqlState);
}
