export const config = {
  env: process.env.EDGE_NOTE_ENV || process.env.NODE_ENV || "production",
  host: process.env.EDGE_NOTE_HOST || "127.0.0.1",
  port: Number(process.env.EDGE_NOTE_PORT || process.env.PORT || 3000),
  publicUrl: process.env.EDGE_NOTE_PUBLIC_URL || "http://localhost:3000",
  ownerUserId: Number(process.env.EDGE_NOTE_OWNER_USER_ID || 1),
  database: {
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    database: process.env.MYSQL_DATABASE || "edge_note",
    user: process.env.MYSQL_USER || "edge_note",
    password: process.env.MYSQL_PASSWORD || "",
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 5)
  },
  attachments: {
    root: process.env.ATTACHMENT_ROOT || "./uploads",
    limitMb: Number(process.env.ATTACHMENT_LIMIT_MB || 25)
  },
  auth: {
    sessionSecret: process.env.EDGE_NOTE_SESSION_SECRET || "change-this-session-secret"
  },
  ai: {
    endpointUrl: process.env.AI_ENDPOINT_URL || "",
    modelName: process.env.AI_MODEL_NAME || "gemma",
    apiKey: process.env.AI_API_KEY || "",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 30000),
    maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 800)
  }
};
