import { config } from "./config.js";
import { checkAiEndpoint, runAiAction } from "./aiRepository.js";
import {
  authStatus,
  changeOwnerPassword,
  clearSessionCookie,
  loginOwner,
  requireAuth,
  setSessionCookie,
  setupOwnerPassword
} from "./authRepository.js";
import { databaseDiagnostics, isDatabaseError } from "./db.js";
import { listDevices, registerDevice, updateDeviceCursor } from "./devicesRepository.js";
import { buildArchiveExport, buildExportStatus, buildJsonExport, buildMarkdownExport } from "./exportRepository.js";
import {
  deleteAttachment,
  getAttachment,
  getAttachmentThumbnail,
  listAttachments,
  replaceAttachment,
  saveAttachment
} from "./attachmentsRepository.js";
import { readJson, readMultipart, requireMethod, sendDownload, sendJson, withSecurityHeaders } from "./http.js";
import { createNotebook, listNotebooks } from "./notebooksRepository.js";
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  listNoteVersions,
  restoreNoteVersion,
  setNoteArchived,
  updateNote
} from "./notesRepository.js";
import { buildSyncBootstrap, pullSyncChanges } from "./syncRepository.js";
import { pushSyncChanges } from "./syncPushRepository.js";
import { ensureTags, listTags } from "./tagsRepository.js";

function parseNoteId(pathname) {
  const match = pathname.match(/^\/api\/notes\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function parseDeviceCursorPath(pathname) {
  const match = pathname.match(/^\/api\/devices\/(\d+)\/cursor$/);
  return match ? Number(match[1]) : null;
}

function parseNoteArchivePath(pathname) {
  const match = pathname.match(/^\/api\/notes\/(\d+)\/(archive|restore)$/);
  return match ? { noteId: Number(match[1]), action: match[2] } : null;
}

function parseNoteVersionsPath(pathname) {
  const match = pathname.match(/^\/api\/notes\/(\d+)\/versions$/);
  return match ? Number(match[1]) : null;
}

function parseNoteVersionRestorePath(pathname) {
  const match = pathname.match(/^\/api\/notes\/(\d+)\/versions\/(\d+)\/restore$/);
  return match ? { noteId: Number(match[1]), versionId: Number(match[2]) } : null;
}

function parseNoteAttachmentsPath(pathname) {
  const match = pathname.match(/^\/api\/notes\/(\d+)\/attachments$/);
  return match ? Number(match[1]) : null;
}

function parseAttachmentDownloadPath(pathname) {
  const match = pathname.match(/^\/api\/attachments\/(\d+)\/download$/);
  return match ? Number(match[1]) : null;
}

function parseAttachmentThumbnailPath(pathname) {
  const match = pathname.match(/^\/api\/attachments\/(\d+)\/thumbnail$/);
  return match ? Number(match[1]) : null;
}

function parseAttachmentPath(pathname) {
  const match = pathname.match(/^\/api\/attachments\/(\d+)$/);
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

function originAllowed(req) {
  if (config.env !== "production") return true;
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;

  const requestOrigin = req.headers.origin || "";
  const referer = req.headers.referer || "";

  try {
    const publicOrigin = new URL(config.publicUrl).origin;
    if (requestOrigin) {
      return requestOrigin === publicOrigin;
    }
    if (referer) {
      return new URL(referer).origin === publicOrigin;
    }
    return false;
  } catch {
    return false;
  }
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

async function safelyAuth(req, res, action) {
  try {
    await action();
  } catch (error) {
    if (isDatabaseError(error)) {
      sendDatabaseUnavailable(res, error);
      return;
    }

    sendJson(res, error.status || 500, {
      error: error.status ? error.message : "Unexpected server error",
      auth: error.auth
    });
  }
}

export async function handleApi(req, res, url) {
  if (!originAllowed(req)) {
    sendJson(res, 403, { error: "Request origin is not allowed." });
    return true;
  }

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

  if (url.pathname === "/api/setup/database-diagnostics") {
    requireMethod(req, ["GET"]);
    sendJson(res, 200, await databaseDiagnostics());
    return true;
  }

  if (url.pathname === "/api/auth/status") {
    await safelyAuth(req, res, async () => {
      requireMethod(req, ["GET"]);
      sendJson(res, 200, await authStatus(req));
    });
    return true;
  }

  if (url.pathname === "/api/auth/setup") {
    await safelyAuth(req, res, async () => {
      requireMethod(req, ["POST"]);
      const userId = await setupOwnerPassword(await readJson(req));
      setSessionCookie(res, userId);
      sendJson(res, 201, { authenticated: true });
    });
    return true;
  }

  if (url.pathname === "/api/auth/login") {
    await safelyAuth(req, res, async () => {
      requireMethod(req, ["POST"]);
      const userId = await loginOwner(await readJson(req));
      setSessionCookie(res, userId);
      sendJson(res, 200, { authenticated: true });
    });
    return true;
  }

  if (url.pathname === "/api/auth/logout") {
    await safelyAuth(req, res, async () => {
      requireMethod(req, ["POST"]);
      clearSessionCookie(res);
      sendJson(res, 200, { authenticated: false });
    });
    return true;
  }

  let authUser;
  try {
    authUser = await requireAuth(req);
  } catch (error) {
    if (isDatabaseError(error)) {
      sendDatabaseUnavailable(res, error);
    } else {
      sendJson(res, error.status || 401, {
        error: error.message,
        auth: error.auth
      });
    }
    return true;
  }
  const userId = authUser.id;

  if (url.pathname === "/api/auth/change-password") {
    await safelyAuth(req, res, async () => {
      requireMethod(req, ["POST"]);
      await changeOwnerPassword(await readJson(req));
      clearSessionCookie(res);
      sendJson(res, 200, { authenticated: false, message: "Password changed. Log in again." });
    });
    return true;
  }

  if (url.pathname === "/api/ai/status") {
    await safely(res, async () => {
      requireMethod(req, ["GET"]);
      sendJson(res, 200, await checkAiEndpoint());
    });
    return true;
  }

  if (url.pathname === "/api/notebooks") {
    await safely(res, async () => {
      if (req.method === "GET") {
        const notebooks = await listNotebooks({ userId });
        sendJson(res, 200, { notebooks });
        return;
      }

      requireMethod(req, ["POST"]);
      const notebooks = await createNotebook({
        userId,
        input: await readJson(req)
      });
      sendJson(res, 201, { notebooks });
    });
    return true;
  }

  if (url.pathname === "/api/tags") {
    await safely(res, async () => {
      if (req.method === "GET") {
        const tags = await listTags({ userId });
        sendJson(res, 200, { tags });
        return;
      }

      requireMethod(req, ["POST"]);
      await ensureTags({
        userId,
        tags: (await readJson(req)).tags || []
      });
      const tags = await listTags({ userId });
      sendJson(res, 201, { tags });
    });
    return true;
  }

  if (url.pathname === "/api/devices") {
    await safely(res, async () => {
      if (req.method === "GET") {
        sendJson(res, 200, { devices: await listDevices({ userId }) });
        return;
      }

      requireMethod(req, ["POST"]);
      const device = await registerDevice({
        userId,
        input: await readJson(req)
      });
      sendJson(res, 201, { device });
    });
    return true;
  }

  const deviceCursorId = parseDeviceCursorPath(url.pathname);
  if (deviceCursorId) {
    await safely(res, async () => {
      requireMethod(req, ["PUT"]);
      const device = await updateDeviceCursor({
        userId,
        deviceId: deviceCursorId,
        cursor: (await readJson(req)).cursor
      });
      sendJson(res, device ? 200 : 404, device ? { device } : { error: "Device not found" });
    });
    return true;
  }

  if (url.pathname === "/api/sync/pull") {
    await safely(res, async () => {
      requireMethod(req, ["GET"]);
      const payload = await pullSyncChanges({
        userId,
        cursor: url.searchParams.get("cursor") || 0,
        limit: url.searchParams.get("limit") || 100,
        includeEntities: url.searchParams.get("include") === "entities"
          || url.searchParams.get("includeEntities") === "1"
      });
      sendJson(res, 200, payload);
    });
    return true;
  }

  if (url.pathname === "/api/sync/bootstrap") {
    await safely(res, async () => {
      requireMethod(req, ["GET"]);
      sendJson(res, 200, await buildSyncBootstrap({
        userId,
        limit: url.searchParams.get("limit") || 1000
      }));
    });
    return true;
  }

  if (url.pathname === "/api/sync/push") {
    await safely(res, async () => {
      requireMethod(req, ["POST"]);
      const payload = await pushSyncChanges({
        userId,
        changes: (await readJson(req)).changes || []
      });
      sendJson(res, 200, payload);
    });
    return true;
  }

  if (url.pathname === "/api/export/status") {
    await safely(res, async () => {
      requireMethod(req, ["GET"]);
      sendJson(res, 200, await buildExportStatus({ userId }));
    });
    return true;
  }

  if (url.pathname === "/api/export.json") {
    await safely(res, async () => {
      requireMethod(req, ["GET"]);
      sendDownload(res, 200, await buildJsonExport({ userId }));
    });
    return true;
  }

  if (url.pathname === "/api/export.md") {
    await safely(res, async () => {
      requireMethod(req, ["GET"]);
      sendDownload(res, 200, await buildMarkdownExport({ userId }));
    });
    return true;
  }

  if (url.pathname === "/api/export.tgz") {
    await safely(res, async () => {
      requireMethod(req, ["GET"]);
      sendDownload(res, 200, await buildArchiveExport({ userId }));
    });
    return true;
  }

  const noteAttachmentsId = parseNoteAttachmentsPath(url.pathname);
  if (noteAttachmentsId) {
    await safely(res, async () => {
      if (req.method === "GET") {
        const attachments = await listAttachments({
          userId,
          noteId: noteAttachmentsId
        });
        sendJson(res, 200, { attachments });
        return;
      }

      requireMethod(req, ["POST"]);
      const { file, files } = await readMultipart(req, {
        limitBytes: (config.attachments.limitMb * 1024 * 1024) + (512 * 1024)
      });
      const attachment = await saveAttachment({
        userId,
        noteId: noteAttachmentsId,
        file,
        thumbnail: files.thumbnail || null
      });
      sendJson(res, 201, { attachment });
    });
    return true;
  }

  const noteArchive = parseNoteArchivePath(url.pathname);
  if (noteArchive) {
    await safely(res, async () => {
      requireMethod(req, ["POST"]);
      const note = await setNoteArchived({
        userId,
        noteId: noteArchive.noteId,
        archived: noteArchive.action === "archive"
      });
      sendJson(res, note ? 200 : 404, note ? { note } : { error: "Note not found" });
    });
    return true;
  }

  const noteVersionsId = parseNoteVersionsPath(url.pathname);
  if (noteVersionsId) {
    await safely(res, async () => {
      requireMethod(req, ["GET"]);
      const versions = await listNoteVersions({
        userId,
        noteId: noteVersionsId,
        limit: url.searchParams.get("limit") || 20
      });
      sendJson(res, 200, { versions });
    });
    return true;
  }

  const noteVersionRestore = parseNoteVersionRestorePath(url.pathname);
  if (noteVersionRestore) {
    await safely(res, async () => {
      requireMethod(req, ["POST"]);
      const note = await restoreNoteVersion({
        userId,
        noteId: noteVersionRestore.noteId,
        versionId: noteVersionRestore.versionId
      });
      sendJson(res, note ? 200 : 404, note ? { note } : { error: "Version not found" });
    });
    return true;
  }

  const aiAction = parseAiActionPath(url.pathname);
  if (aiAction) {
    await safely(res, async () => {
      requireMethod(req, ["POST"]);
      const input = await readJson(req);
      const result = await runAiAction({
        userId,
        noteId: aiAction.noteId,
        action: aiAction.action,
        question: input.question || ""
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
        userId,
        attachmentId
      });
      if (!attachment) {
        sendJson(res, 404, { error: "Attachment not found" });
        return;
      }

      res.writeHead(200, withSecurityHeaders({
        "content-type": attachment.mimeType,
        "content-disposition": `attachment; filename="${attachment.filename}"`,
        "content-length": attachment.sizeBytes,
        "cache-control": "private, max-age=300"
      }));
      attachment.stream().pipe(res);
    });
    return true;
  }

  const thumbnailAttachmentId = parseAttachmentThumbnailPath(url.pathname);
  if (thumbnailAttachmentId) {
    await safely(res, async () => {
      requireMethod(req, ["GET"]);
      const attachment = await getAttachmentThumbnail({
        userId,
        attachmentId: thumbnailAttachmentId
      });
      if (!attachment) {
        sendJson(res, 404, { error: "Thumbnail not found" });
        return;
      }

      res.writeHead(200, withSecurityHeaders({
        "content-type": attachment.thumbnailMimeType,
        "content-length": attachment.thumbnailSizeBytes,
        "cache-control": "private, max-age=86400"
      }));
      attachment.thumbnailStream().pipe(res);
    });
    return true;
  }

  const managedAttachmentId = parseAttachmentPath(url.pathname);
  if (managedAttachmentId) {
    await safely(res, async () => {
      if (req.method === "DELETE") {
        const deleted = await deleteAttachment({ userId, attachmentId: managedAttachmentId });
        sendJson(res, deleted ? 200 : 404, deleted ? { ok: true } : { error: "Attachment not found" });
        return;
      }

      if (req.method === "PUT") {
        const { file, files } = await readMultipart(req, {
          limitBytes: (config.attachments.limitMb * 1024 * 1024) + (512 * 1024)
        });
        const attachment = await replaceAttachment({
          userId,
          attachmentId: managedAttachmentId,
          file,
          thumbnail: files.thumbnail || null
        });
        sendJson(res, attachment ? 200 : 404, attachment ? { attachment } : { error: "Attachment not found" });
        return;
      }

      requireMethod(req, ["DELETE", "PUT"]);
    });
    return true;
  }

  if (url.pathname === "/api/notes") {
    await safely(res, async () => {
      if (req.method === "GET") {
        const notes = await listNotes({
          userId,
          search: url.searchParams.get("q") || "",
          notebookId: url.searchParams.get("notebookId") || null,
          tag: url.searchParams.get("tag") || "",
          favorite: url.searchParams.get("favorite") === "1",
          tasks: url.searchParams.get("tasks") === "1",
          archived: url.searchParams.get("archived") || "all",
          limit: url.searchParams.get("limit") || 50
        });
        sendJson(res, 200, { notes, cursor: null });
        return;
      }

      requireMethod(req, ["POST"]);
      const note = await createNote({
        userId,
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
        const note = await getNote({ userId, noteId });
        sendJson(res, note ? 200 : 404, note ? { note } : { error: "Note not found" });
        return;
      }

      if (req.method === "PUT") {
        const note = await updateNote({
          userId,
          noteId,
          input: await readJson(req)
        });
        sendJson(res, note ? 200 : 404, note ? { note } : { error: "Note not found" });
        return;
      }

      if (req.method === "DELETE") {
        const deleted = await deleteNote({ userId, noteId });
        sendJson(res, deleted ? 200 : 404, deleted ? { ok: true } : { error: "Note not found" });
        return;
      }

      requireMethod(req, ["GET", "PUT", "DELETE"]);
    });
    return true;
  }

  return false;
}
