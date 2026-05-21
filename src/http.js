const maxJsonBytes = 1024 * 1024;

export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
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
