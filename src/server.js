import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const publicDir = join(rootDir, "public");

const port = Number(process.env.EDGE_NOTE_PORT || process.env.PORT || 3000);
const host = process.env.EDGE_NOTE_HOST || "127.0.0.1";
const env = process.env.EDGE_NOTE_ENV || process.env.NODE_ENV || "production";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

function safePublicPath(pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const cleanPath = normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, cleanPath);
  const withinPublic = relative(publicDir, filePath);

  if (withinPublic.startsWith("..") || withinPublic === "") {
    return join(publicDir, "index.html");
  }

  return filePath;
}

async function serveStatic(req, res, url) {
  const filePath = safePublicPath(url.pathname);
  const type = contentTypes[extname(filePath)] || "application/octet-stream";

  try {
    await readFile(filePath, { flag: "r" });
    res.writeHead(200, {
      "content-type": type,
      "cache-control": env === "development" ? "no-store" : "public, max-age=300"
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

function handleApi(req, res, url) {
  if (url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "edge-note",
      env,
      timestamp: new Date().toISOString()
    });
    return true;
  }

  if (url.pathname === "/api/config") {
    sendJson(res, 200, {
      attachmentLimitMb: 25,
      syncMode: "manual",
      aiEnabled: Boolean(process.env.AI_ENDPOINT_URL),
      aiModelName: process.env.AI_MODEL_NAME || "gemma"
    });
    return true;
  }

  if (url.pathname === "/api/notes") {
    sendJson(res, 200, {
      notes: [],
      cursor: null,
      message: "MySQL-backed notes arrive in the next build step."
    });
    return true;
  }

  return false;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname.startsWith("/api/")) {
    const handled = handleApi(req, res, url);
    if (!handled) {
      sendJson(res, 404, { error: "Unknown API route" });
    }
    return;
  }

  await serveStatic(req, res, url);
});

server.on("error", (error) => {
  console.error(`EDGE Note failed to start: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`EDGE Note running on http://${host}:${port}`);
});
