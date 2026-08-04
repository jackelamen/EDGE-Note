import { createNote, deleteNote, getNote, updateNote } from "./notesRepository.js";
import { latestSyncCursor } from "./syncRepository.js";

const supportedEntities = new Set(["note"]);
const supportedActions = new Set(["create", "update", "delete"]);

function normalizeChange(change) {
  return {
    clientId: change.clientId || change.clientMutationId || null,
    entityType: change.entityType,
    action: change.action,
    entityId: Number(change.entityId || change.id || change.noteId || 0) || null,
    baseSyncVersion: Number(change.baseSyncVersion || 0) || null,
    data: change.data || change.note || {}
  };
}

function validateChange(change) {
  if (!supportedEntities.has(change.entityType)) {
    return `Unsupported entity type: ${change.entityType || "missing"}`;
  }
  if (!supportedActions.has(change.action)) {
    return `Unsupported action: ${change.action || "missing"}`;
  }
  if (change.action !== "create" && !change.entityId) {
    return "Existing note id is required.";
  }
  return null;
}

async function applyNoteChange({ userId, change }) {
  if (change.action === "create") {
    // Idempotency guard: if this exact queued change (identified by the
    // client-generated clientId) was already applied on a previous retry,
    // return that existing note instead of inserting a duplicate. This is
    // what was creating repeated "Untitled note" copies whenever the
    // client retried a create after a slow response, a timeout, or a
    // server outage without ever getting a clean "applied" result back.
    const note = await createNote({
      userId,
      input: change.data,
      syncClientId: change.clientId
    });
    return { status: "applied", note };
  }

  const serverNote = await getNote({ userId, noteId: change.entityId });
  if (!serverNote && change.action !== "delete") {
    return { status: "not_found" };
  }

  if (
    change.action === "update"
    && change.baseSyncVersion
    && serverNote.syncVersion !== change.baseSyncVersion
  ) {
    return {
      status: "conflict",
      serverNote,
      message: "Server note changed since the client edit began."
    };
  }

  if (change.action === "update") {
    const note = await updateNote({
      userId,
      noteId: change.entityId,
      input: change.data
    });
    return { status: note ? "applied" : "not_found", note };
  }

  const deleted = await deleteNote({ userId, noteId: change.entityId });
  return { status: deleted ? "applied" : "not_found" };
}

export async function pushSyncChanges({ userId, changes = [] }) {
  const safeChanges = Array.isArray(changes) ? changes.slice(0, 50) : [];
  const results = [];

  for (const rawChange of safeChanges) {
    const change = normalizeChange(rawChange);
    const validationError = validateChange(change);

    if (validationError) {
      results.push({
        clientId: change.clientId,
        status: "rejected",
        message: validationError
      });
      continue;
    }

    try {
      results.push({
        clientId: change.clientId,
        entityType: change.entityType,
        action: change.action,
        ...(await applyNoteChange({ userId, change }))
      });
    } catch (error) {
      results.push({
        clientId: change.clientId,
        status: "error",
        message: error.message
      });
    }
  }

  return {
    accepted: results.filter((result) => result.status === "applied").length,
    rejected: results.filter((result) => result.status !== "applied").length,
    cursor: await latestSyncCursor({ userId }),
    serverTime: new Date().toISOString(),
    results
  };
}
