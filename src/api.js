import { config } from "./config.js";
import { isDatabaseError } from "./db.js";
import { readJson, requireMethod, sendJson } from "./http.js";
import { createNote, deleteNote, getNote, listNotes, updateNote } from "./notesRepository.js";

function parseNoteId(pathname) {
  const match = pathname.match(/^\/api\/notes\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function sendDatabaseUnavailable(res, error) {
  sendJson(res, 503, {
    error: "Database unavailable",
    code: error.code || "DATABASE_ERROR",
    message: error.code === "MYSQL_DRIVER_MISSING"
      ? error.message
      : "Check MySQL settings and schema before using notes."
  });
}

async function safely(res, action) {
  try {
    await action();
  } catch (error) {
    if (isDatabaseError(error)) {
      sendDatabaseUnavailable(res, error);
      return;
    }

    sendJson(res, error.status || 500, {
      error: error.status ? error.message : "Unexpected server error"
    });
  }
}

export async function handleApi(req, res, url) {
  if (url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "edge-note",
      env: config.env,
      timestamp: new Date().toISOString()
    });
    return true;
  }

  if (url.pathname === "/api/config") {
    sendJson(res, 200, {
      attachmentLimitMb: config.attachments.limitMb,
      syncMode: "manual",
      aiEnabled: Boolean(config.ai.endpointUrl),
      aiModelName: config.ai.modelName
    });
    return true;
  }

  if (url.pathname === "/api/notes") {
    await safely(res, async () => {
      if (req.method === "GET") {
        const notes = await listNotes({
          userId: config.ownerUserId,
          search: url.searchParams.get("q") || "",
          limit: url.searchParams.get("limit") || 50
        });
        sendJson(res, 200, { notes, cursor: null });
        return;
      }

      requireMethod(req, ["POST"]);
      const note = await createNote({
        userId: config.ownerUserId,
        input: await readJson(req)
      });
      sendJson(res, 201, { note });
    });
    return true;
  }

  const noteId = parseNoteId(url.pathname);
  if (noteId) {
    await safely(res, async () => {
      if (req.method === "GET") {
        const note = await getNote({ userId: config.ownerUserId, noteId });
        sendJson(res, note ? 200 : 404, note ? { note } : { error: "Note not found" });
        return;
      }

      if (req.method === "PUT") {
        const note = await updateNote({
          userId: config.ownerUserId,
          noteId,
          input: await readJson(req)
        });
        sendJson(res, note ? 200 : 404, note ? { note } : { error: "Note not found" });
        return;
      }

      if (req.method === "DELETE") {
        const deleted = await deleteNote({ userId: config.ownerUserId, noteId });
        sendJson(res, deleted ? 200 : 404, deleted ? { ok: true } : { error: "Note not found" });
        return;
      }

      requireMethod(req, ["GET", "PUT", "DELETE"]);
    });
    return true;
  }

  return false;
}
