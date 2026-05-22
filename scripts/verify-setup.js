import { readFile } from "node:fs/promises";

const requiredEnv = [
  "EDGE_NOTE_ENV",
  "EDGE_NOTE_HOST",
  "EDGE_NOTE_PORT",
  "EDGE_NOTE_PUBLIC_URL",
  "EDGE_NOTE_OWNER_USER_ID",
  "EDGE_NOTE_SESSION_SECRET",
  "MYSQL_HOST",
  "MYSQL_PORT",
  "MYSQL_DATABASE",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "ATTACHMENT_ROOT",
  "AI_ENDPOINT_URL",
  "AI_MODEL_NAME"
];

const requiredTables = [
  "users",
  "notebooks",
  "notes",
  "note_versions",
  "tags",
  "note_tags",
  "attachments",
  "sync_changes",
  "ai_outputs",
  "devices"
];

const requiredUiHooks = [
  "data-auth-panel",
  "data-app-shell",
  "data-notes-list",
  "data-note-title",
  "data-note-body",
  "data-note-notebook",
  "data-note-tags",
  "data-attachment-file",
  "data-ai-action",
  "data-export"
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function verifyEnvExample() {
  const envExample = await readFile(".env.example", "utf8");
  for (const key of requiredEnv) {
    assert(envExample.includes(`${key}=`), `.env.example is missing ${key}`);
  }
}

async function verifySchema() {
  const schema = await readFile("database/schema.sql", "utf8");
  for (const table of requiredTables) {
    assert(schema.includes(`CREATE TABLE ${table}`), `schema.sql is missing ${table}`);
  }
}

async function verifyUiHooks() {
  const html = await readFile("public/index.html", "utf8");
  for (const hook of requiredUiHooks) {
    assert(html.includes(hook), `index.html is missing ${hook}`);
  }
}

await verifyEnvExample();
await verifySchema();
await verifyUiHooks();

console.log("EDGE Note setup verification passed.");
