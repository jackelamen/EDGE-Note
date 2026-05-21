import { config } from "./config.js";
import { runAiAction } from "./aiRepository.js";
import { isDatabaseError } from "./db.js";
import { buildJsonExport, buildMarkdownExport } from "./exportRepository.js";
import { getAttachment, listAttachments, saveAttachment } from "./attachmentsRepository.js";
import { readJson, readMultipart, requireMethod, sendDownload, sendJson } from "./http.js";
import { createNotebook, listNotebooks } from "./notebooksRepository.js";
import { createNote, deleteNote, getNote, listNotes, updateNote } from "./notesRepository.js";
import { pullSyncChanges } from "./syncRepository.js";
import { ensureTags, listTags } from "./tagsRepository.js";

function parseNoteId(pathname) {
  const match = pathname.match(/^\/api\/notes\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function parseNoteAttachmentsPath(pathname) {
  const match = pathname.match(/^\/api\/notes\/(\d+)\/attachments$/);
  return match ? Number(match[1]) : null;
}

function parseAttachmentDownloadPath(pathname) {
  const match = pathname.match(/^\/api\/attachments\/(\d+)\/download$/);
  return match ? Number(match[1]) : null;
}

function parseAiActionPath(pathname) {
  const match = pathname.match(/^\/api\/notes\/(\d+)\/ai\/([a-z-]+)$/);
  return match ? { noteId: Number(match[1]), action: match[2] } : null;
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

  if (url.pathname === "/api/notebooks") {
    await safely(res, async () => {
      if (req.method === "GET") {
        const notebooks = await listNotebooks({ userId: config.ownerUserId });
        sendJson(res, 200, { notebooks });
        return;
      }

      requireMethod(req, ["POST"]);
      const notebooks = await createNotebook({
        userId: config.ownerUserId,
        input: await readJson(req)
      });
      sendJson(res, 201, { notebooks });
    });
    return true;
  }

  if (url.pathname === "/api/tags") {
    await safely(res, async () => {
      if (req.method === "GET") {
        const tags = await listTags({ userId: config.ownerUserId });
        sendJson(res, 200, { tags });
        return;
      }

      requireMethod(req, ["POST"]);
      await ensureTags({
        userId: config.ownerUserId,
        tags: (await readJson(req)).tags || []
      });
      const tags = await listTags({ userId: config.ownerUserId });
      sendJson(res, 201, { tags });
    });
    return true;
  }

  if (url.pathname === "/api/sync/pull") {
    await safely(res, async () => {
      requireMethod(req, ["GET"]);
      const payload = await pullSyncChanges({
        userId: config.ownerUserId,
        cursor: url.searchParams.get("cursor") || 0,
        limit: url.searchParams.get("limit") || 100
      });
      sendJson(res, 200, payload);
    });
    return true;
  }

  if (url.pathname === "/api/export.json") {
    await safely(res, async () => {
      requireMethod(req, ["GET"]);
      sendDownload(res, 200, await buildJsonExport({ userId: config.ownerUserId }));
    });
    return true;
  }

  if (url.pathname === "/api/export.md") {
    await safely(res, async () => {
      requireMethod(req, ["GET"]);
      sendDownload(res, 200, await buildMarkdownExport({ userId: config.ownerUserId }));
    });
    return true;
  }

  const noteAttachmentsId = parseNoteAttachmentsPath(url.pathname);
  if (noteAttachmentsId) {
    await safely(res, async () => {
      if (req.method === "GET") {
        const attachments = await listAttachments({
          userId: config.ownerUserId,
          noteId: noteAttachmentsId
        });
        sendJson(res, 200, { attachments });
        return;
      }

      requireMethod(req, ["POST"]);
      const { file } = await readMultipart(req, {
        limitBytes: config.attachments.limitMb * 1024 * 1024
      });
      const attachment = await saveAttachment({
        userId: config.ownerUserId,
        noteId: noteAttachmentsId,
        file
      });
      sendJson(res, 201, { attachment });
    });
    return true;
  }

  const aiAction = parseAiActionPath(url.pathname);
  if (aiAction) {
    await safely(res, async () => {
      requireMethod(req, ["POST"]);
      const result = await runAiAction({
        userId: config.ownerUserId,
        noteId: aiAction.noteId,
        action: aiAction.action
      });
      sendJson(res, 200, result);
    });
    return true;
  }

  const attachmentId = parseAttachmentDownloadPath(url.pathname);
  if (attachmentId) {
    await safely(res, async () => {
      requireMethod(req, ["GET"]);
      const attachment = await getAttachment({
        userId: config.ownerUserId,
        attachmentId
      });
      if (!attachment) {
        sendJson(res, 404, { error: "Attachment not found" });
        return;
      }

      res.writeHead(200, {
        "content-type": attachment.mimeType,
        "content-disposition": `attachment; filename="${attachment.filename}"`,
        "content-length": attachment.sizeBytes,
        "cache-control": "private, max-age=300"
      });
      attachment.stream().pipe(res);
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
