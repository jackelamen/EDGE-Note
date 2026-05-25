/**
 * reset-content.mjs
 *
 * Wipes all notes, notebooks, attachments, tags, and related data
 * for the app's user(s). Leaves users and devices intact so login
 * and session still work.
 *
 * Safe to run multiple times — just deletes rows, does not drop tables.
 *
 * Usage (from the project root):
 *   node scripts/reset-content.mjs [--dry-run]
 *
 * Always do a dry run first to confirm what will be deleted:
 *   node scripts/reset-content.mjs --dry-run
 */

import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Parse .env manually — no dotenv dependency needed
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envText = readFileSync(join(__dirname, "../.env"), "utf8");
  for (const line of envText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
} catch { /* no .env file — rely on environment variables */ }

const dryRun = process.argv.includes("--dry-run");
if (dryRun) console.log("DRY RUN — no changes will be written.\n");

const db = await mysql.createConnection({
  host:     process.env.MYSQL_HOST     || "localhost",
  port:     Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE || "edge_note",
  user:     process.env.MYSQL_USER     || "edge_note",
  password: process.env.MYSQL_PASSWORD || "",
});

// Count what exists before doing anything
const [[{ notes }]]        = await db.execute("SELECT COUNT(*) AS notes        FROM notes");
const [[{ notebooks }]]    = await db.execute("SELECT COUNT(*) AS notebooks    FROM notebooks");
const [[{ attachments }]]  = await db.execute("SELECT COUNT(*) AS attachments  FROM attachments");
const [[{ tags }]]         = await db.execute("SELECT COUNT(*) AS tags         FROM tags");
const [[{ noteTags }]]     = await db.execute("SELECT COUNT(*) AS noteTags     FROM note_tags");
const [[{ noteVersions }]] = await db.execute("SELECT COUNT(*) AS noteVersions FROM note_versions");
const [[{ aiOutputs }]]    = await db.execute("SELECT COUNT(*) AS aiOutputs    FROM ai_outputs");
const [[{ syncChanges }]]  = await db.execute("SELECT COUNT(*) AS syncChanges  FROM sync_changes");

console.log("Rows that will be deleted:");
console.log(`  notes          ${notes}`);
console.log(`  note_versions  ${noteVersions}`);
console.log(`  note_tags      ${noteTags}`);
console.log(`  attachments    ${attachments}`);
console.log(`  ai_outputs     ${aiOutputs}`);
console.log(`  sync_changes   ${syncChanges}`);
console.log(`  tags           ${tags}`);
console.log(`  notebooks      ${notebooks}`);
console.log("");

if (dryRun) {
  console.log("Dry run complete. Run without --dry-run to delete.");
  await db.end();
  process.exit(0);
}

// Confirm before proceeding (unless FORCE env var is set)
if (!process.env.FORCE) {
  console.log("Set FORCE=1 to skip this prompt, or re-run with --dry-run to preview.");
  console.log("Type YES to confirm deletion: ");

  const answer = await new Promise((resolve) => {
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (d) => resolve(d.trim()));
  });

  if (answer !== "YES") {
    console.log("Aborted.");
    await db.end();
    process.exit(0);
  }
}

// Disable FK checks for the duration so order doesn't matter
await db.execute("SET FOREIGN_KEY_CHECKS = 0");

try {
  await db.execute("DELETE FROM ai_outputs");
  console.log("  Deleted ai_outputs");

  await db.execute("DELETE FROM note_versions");
  console.log("  Deleted note_versions");

  await db.execute("DELETE FROM note_tags");
  console.log("  Deleted note_tags");

  await db.execute("DELETE FROM attachments");
  console.log("  Deleted attachments");

  await db.execute("DELETE FROM sync_changes");
  console.log("  Deleted sync_changes");

  await db.execute("DELETE FROM notes");
  console.log("  Deleted notes");

  await db.execute("DELETE FROM tags");
  console.log("  Deleted tags");

  await db.execute("DELETE FROM notebooks");
  console.log("  Deleted notebooks");

  // Reset auto-increment counters so IDs start from 1 again
  for (const table of ["notes", "note_versions", "attachments", "ai_outputs", "sync_changes", "tags", "notebooks"]) {
    await db.execute(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
  }
  console.log("  Reset AUTO_INCREMENT on all tables");

} finally {
  await db.execute("SET FOREIGN_KEY_CHECKS = 1");
}

await db.end();
console.log("\nDone. All content cleared. Users and devices untouched.");
