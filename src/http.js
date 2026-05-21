const maxJsonBytes = 1024 * 1024;

export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

export function sendDownload(res, status, { filename, contentType, body }) {
  res.writeHead(status, {
    "content-type": contentType,
    "content-disposition": `attachment; filename="${filename}"`,
    "cache-control": "no-store"
  });
  res.end(body);
}

function splitBuffer(buffer, separator) {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(separator, start);

  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + separator.length;
    index = buffer.indexOf(separator, start);
  }

  parts.push(buffer.subarray(start));
  return parts;
}

function parseContentDisposition(value = "") {
  const fields = {};
  for (const part of value.split(";")) {
    const [key, raw] = part.trim().split("=");
    if (raw) {
      fields[key] = raw.replace(/^"|"$/g, "");
    }
  }
  return fields;
}

export async function readMultipart(req, { limitBytes }) {
  const contentType = req.headers["content-type"] || "";
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1]
    || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];

  if (!boundary) {
    const error = new Error("Multipart boundary is missing.");
    error.status = 400;
    throw error;
  }

  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) {
      const error = new Error("Attachment is too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks);
  const parts = splitBuffer(body, Buffer.from(`--${boundary}`));
  const fields = {};
  let file = null;

  for (const rawPart of parts) {
    let part = rawPart;
    if (!part.length || part.equals(Buffer.from("--\r\n")) || part.equals(Buffer.from("--"))) continue;
    if (part.subarray(0, 2).toString() === "\r\n") {
      part = part.subarray(2);
    }
    if (part.subarray(-2).toString() === "\r\n") {
      part = part.subarray(0, -2);
    }
    if (part.subarray(-2).toString() === "--") {
      part = part.subarray(0, -2);
    }

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) continue;

    const headerText = part.subarray(0, headerEnd).toString("utf8");
    const content = part.subarray(headerEnd + 4);
    const headers = Object.fromEntries(headerText.split("\r\n").map((line) => {
      const separator = line.indexOf(":");
      return [line.slice(0, separator).toLowerCase(), line.slice(separator + 1).trim()];
    }));
    const disposition = parseContentDisposition(headers["content-disposition"]);

    if (disposition.filename) {
      file = {
        fieldName: disposition.name,
        filename: disposition.filename,
        mimeType: headers["content-type"] || "application/octet-stream",
        buffer: content
      };
    } else if (disposition.name) {
      fields[disposition.name] = content.toString("utf8");
    }
  }

  return { fields, file };
}

export async function readJson(req) {
  let body = "";

  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > maxJsonBytes) {
      const error = new Error("JSON request body is too large.");
      error.status = 413;
      throw error;
    }
  }

  if (!body.trim()) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.status = 400;
    throw error;
  }
}

export function requireMethod(req, allowed) {
  if (allowed.includes(req.method)) {
    return;
  }

  const error = new Error(`Method ${req.method} is not supported.`);
  error.status = 405;
  throw error;
}
