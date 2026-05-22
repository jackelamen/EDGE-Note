const required = [
  "EDGE_NOTE_ENV",
  "EDGE_NOTE_HOST",
  "EDGE_NOTE_PUBLIC_URL",
  "EDGE_NOTE_OWNER_USER_ID",
  "EDGE_NOTE_SESSION_SECRET",
  "MYSQL_HOST",
  "MYSQL_PORT",
  "MYSQL_DATABASE",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "ATTACHMENT_ROOT"
];

const placeholderValues = new Set([
  "",
  "change-me",
  "replace-with-a-long-random-secret",
  "change-this-session-secret"
]);

function fail(message) {
  console.error(`Production check failed: ${message}`);
  process.exitCode = 1;
}

for (const key of required) {
  const value = process.env[key] || "";
  if (placeholderValues.has(value)) {
    fail(`${key} is missing or still uses a placeholder value.`);
  }
}

if (process.env.EDGE_NOTE_ENV !== "production") {
  fail("EDGE_NOTE_ENV must be production.");
}

if (process.env.EDGE_NOTE_HOST !== "0.0.0.0") {
  fail("EDGE_NOTE_HOST should be 0.0.0.0 on Hostinger.");
}

if (!/^https:\/\//.test(process.env.EDGE_NOTE_PUBLIC_URL || "")) {
  fail("EDGE_NOTE_PUBLIC_URL should use https in production.");
}

if ((process.env.EDGE_NOTE_SESSION_SECRET || "").length < 32) {
  fail("EDGE_NOTE_SESSION_SECRET should be at least 32 characters.");
}

const port = Number(process.env.MYSQL_PORT || 0);
if (!Number.isInteger(port) || port <= 0) {
  fail("MYSQL_PORT must be a positive number.");
}

const ownerId = Number(process.env.EDGE_NOTE_OWNER_USER_ID || 0);
if (!Number.isInteger(ownerId) || ownerId <= 0) {
  fail("EDGE_NOTE_OWNER_USER_ID must be a positive number.");
}

if (!process.exitCode) {
  console.log("EDGE Note production environment check passed.");
}
