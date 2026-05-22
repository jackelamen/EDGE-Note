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

const appPort = Number(process.env.EDGE_NOTE_PORT || process.env.PORT || 0);
if (!Number.isInteger(appPort) || appPort <= 0) {
  fail("EDGE_NOTE_PORT or PORT must be a positive number.");
}

const port = Number(process.env.MYSQL_PORT || 0);
if (!Number.isInteger(port) || port <= 0) {
  fail("MYSQL_PORT must be a positive number.");
}

const ownerId = Number(process.env.EDGE_NOTE_OWNER_USER_ID || 0);
if (!Number.isInteger(ownerId) || ownerId <= 0) {
  fail("EDGE_NOTE_OWNER_USER_ID must be a positive number.");
}

if (Number(process.env.ATTACHMENT_LIMIT_MB || 25) <= 0) {
  fail("ATTACHMENT_LIMIT_MB must be greater than zero.");
}

if (process.env.MYSQL_HOST === "localhost") {
  fail("MYSQL_HOST should be an explicit Hostinger host or 127.0.0.1, not localhost.");
}

if (process.env.AI_ENDPOINT_URL || process.env.AI_API_KEY) {
  if (!/^https:\/\//.test(process.env.AI_ENDPOINT_URL || "")) {
    fail("AI_ENDPOINT_URL should use https when AI is configured.");
  }
  if (!process.env.AI_MODEL_NAME) {
    fail("AI_MODEL_NAME is required when AI is configured.");
  }
  if (!process.env.AI_API_KEY) {
    fail("AI_API_KEY is required when AI is configured.");
  }
}

if (!process.exitCode) {
  console.log("EDGE Note production environment check passed.");
}
