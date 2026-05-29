import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi } from "./api.js";
import { config } from "./config.js";
import { sendJson, withSecurityHeaders } from "./http.js";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const publicDir = join(rootDir, "public");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml"
};

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
    res.writeHead(200, withSecurityHeaders({
      "content-type": type,
      "cache-control": "no-store, no-cache, must-revalidate",
      "pragma": "no-cache",
      "expires": "0"
    }));
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, withSecurityHeaders({ "content-type": "text/plain; charset=utf-8" }));
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, url);
      if (!handled) {
        sendJson(res, 404, { error: "Unknown API route" });
      }
      return;
    }

    await serveStatic(req, res, url);
  } catch (error) {
    console.error(`EDGE Note request failed: ${error.message}`);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Unexpected server error" });
    } else {
      res.destroy();
    }
  }
});

server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
server.keepAliveTimeout = 5_000;

server.on("error", (error) => {
  console.error(`EDGE Note failed to start: ${error.message}`);
  process.exitCode = 1;
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled EDGE Note rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught EDGE Note exception:", error);
  process.exitCode = 1;
});

server.listen(config.port, config.host, () => {
  console.log(`EDGE Note running on http://${config.host}:${config.port}`);
});
