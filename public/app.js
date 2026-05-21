const cacheKeys = {
  draft: "edge_note_draft_v1",
  notes: "edge_note_notes_v1",
  collections: "edge_note_collections_v1",
  selectedId: "edge_note_selected_note_v1"
};

const state = {
  attachments: [],
  notebooks: [],
  notes: [],
  tags: [],
  localDraftRestored: false,
  selectedId: null,
  pendingSave: false
};

const elements = {
  attachmentFile: document.querySelector("[data-attachment-file]"),
  attachmentList: document.querySelector("[data-attachments-list]"),
  aiActions: document.querySelectorAll("[data-ai-action]"),
  aiResult: document.querySelector("[data-ai-result]"),
  body: document.querySelector("[data-note-body]"),
  cacheStatus: document.querySelector("[data-cache-status]"),
  cacheTitle: document.querySelector("[data-cache-title]"),
  exportJson: document.querySelector("[data-export='json']"),
  exportMarkdown: document.querySelector("[data-export='markdown']"),
  list: document.querySelector("[data-notes-list]"),
  meta: document.querySelector("[data-note-meta]"),
  newNote: document.querySelector("[data-action='new-note']"),
  notebook: document.querySelector("[data-note-notebook]"),
  notebooksList: document.querySelector("[data-notebooks-list]"),
  saveNote: document.querySelector("[data-action='save-note']"),
  search: document.querySelector("[data-notes-search]"),
  tags: document.querySelector("[data-note-tags]"),
  tagsList: document.querySelector("[data-tags-list]"),
  title: document.querySelector("[data-note-title]"),
  uploadAttachment: document.querySelector("[data-action='upload-attachment']")
};

function readCache(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeCache(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cache failure should not block note editing.
  }
}

function removeCache(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Cache failure should not block note editing.
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function notePreview(note) {
  const preview = String(note.body || "").replace(/\s+/g, " ").trim();
  return preview || "No body yet";
}

function formatDate(value) {
  if (!value) return "Not saved yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function setCacheStatus(title, text) {
  elements.cacheTitle.textContent = title;
  elements.cacheStatus.textContent = text;
}

function setStatus(text) {
  elements.meta.textContent = `${state.selectedId ? `Note ${state.selectedId}` : "Draft"} · ${text}`;
}

function splitTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function currentDraft() {
  return {
    notebookId: elements.notebook.value ? Number(elements.notebook.value) : null,
    title: elements.title.value,
    body: elements.body.value,
    bodyFormat: "markdown",
    tags: splitTags(elements.tags.value)
  };
}

function saveDraftCache() {
  state.localDraftRestored = true;
  writeCache(cacheKeys.draft, {
    ...currentDraft(),
    selectedId: state.selectedId,
    cachedAt: new Date().toISOString()
  });
  setCacheStatus("Draft cached", "Saved in this browser");
}

function clearDraftCache() {
  removeCache(cacheKeys.draft);
}

function restoreDraftCache() {
  const draft = readCache(cacheKeys.draft, null);
  if (!draft) return false;

  state.localDraftRestored = true;
  state.selectedId = draft.selectedId || null;
  elements.notebook.value = draft.notebookId || "";
  elements.tags.value = (draft.tags || []).join(", ");
  elements.title.value = draft.title || "Untitled note";
  elements.body.value = draft.body || "";
  setStatus(`Restored local draft from ${formatDate(draft.cachedAt)}`);
  setCacheStatus("Draft restored", "Review and sync when ready");
  return true;
}

function selectNote(note) {
  state.selectedId = note?.id || null;
  elements.notebook.value = note?.notebookId || "";
  elements.tags.value = (note?.tags || []).join(", ");
  elements.title.value = note?.title || "Untitled note";
  elements.body.value = note?.body || "";
  setStatus(note?.updatedAt ? `Updated ${formatDate(note.updatedAt)}` : "Not saved yet");
  if (note?.id) {
    writeCache(cacheKeys.selectedId, note.id);
    loadAttachments(note.id);
  } else {
    state.attachments = [];
    renderAttachments();
  }
  renderNotes();
}

function renderAttachments() {
  if (!state.selectedId) {
    elements.attachmentList.innerHTML = '<div class="empty-state">Save a note before adding attachments.</div>';
    return;
  }

  if (!state.attachments.length) {
    elements.attachmentList.innerHTML = '<div class="empty-state">No attachments yet.</div>';
    return;
  }

  elements.attachmentList.innerHTML = state.attachments.map((attachment) => `
    <a class="attachment-item" href="${attachment.downloadUrl}">
      <span>${escapeHtml(attachment.filename)}</span>
      <small>${escapeHtml(formatBytes(attachment.sizeBytes))}</small>
    </a>
  `).join("");
}

function renderAiOutput(payload) {
  const output = payload.output || {};
  const action = payload.action?.replaceAll("-", " ") || "AI";
  let body = output.text || "";

  if (Array.isArray(output.summary)) {
    body = output.summary.map((item) => `- ${item}`).join("\n");
  } else if (Array.isArray(output.tasks)) {
    body = output.tasks.map((item) => `- ${item}`).join("\n");
  } else if (Array.isArray(output.tags)) {
    body = output.tags.map((item) => `#${item}`).join(" ");
  } else if (output.title) {
    body = output.title;
  } else if (!body) {
    body = JSON.stringify(output, null, 2);
  }

  elements.aiResult.textContent = `${action}${payload.cached ? " (cached)" : ""}\n${body}`;
}

function renderCollections() {
  const selectedNotebook = elements.notebook.value;
  const notebookOptions = [
    '<option value="">No notebook</option>',
    ...state.notebooks.map((notebook) => (
      `<option value="${notebook.id}">${escapeHtml(notebook.name)}</option>`
    ))
  ];

  elements.notebook.innerHTML = notebookOptions.join("");
  elements.notebook.value = selectedNotebook;
  elements.notebooksList.innerHTML = `
    <h2 id="notebook-heading">Notebooks</h2>
    ${state.notebooks.length ? state.notebooks.map((notebook) => `
      <a href="#notebook-${notebook.id}" data-notebook-filter="${notebook.id}">
        ${escapeHtml(notebook.name)}
        <span>${notebook.noteCount || 0}</span>
      </a>
    `).join("") : '<a href="#setup">Connect MySQL</a>'}
  `;
  elements.tagsList.innerHTML = state.tags.map((tag) => (
    `<option value="${escapeHtml(tag.name)}"></option>`
  )).join("");
}

function renderNotes() {
  if (!state.notes.length) {
    elements.list.innerHTML = `
      <article class="note-card active">
        <span class="tag">Empty</span>
        <h2>No notes yet</h2>
        <p>Create the first note, then sync it to MySQL.</p>
        <footer>
          <span>Ready</span>
          <span>0 notes</span>
        </footer>
      </article>
    `;
    return;
  }

  elements.list.innerHTML = state.notes.map((note) => `
    <article class="note-card ${note.id === state.selectedId ? "active" : ""}" data-note-id="${note.id}">
      <span class="tag">${escapeHtml(note.tags?.[0] || note.notebookName || "Note")}</span>
      <h2>${escapeHtml(note.title || "Untitled note")}</h2>
      <p>${escapeHtml(notePreview(note))}</p>
      <footer>
        <span>${escapeHtml(formatDate(note.updatedAt))}</span>
        <span>v${note.syncVersion || 1}</span>
      </footer>
    </article>
  `).join("");
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "Request failed");
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function hydrateConfig() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) return;
    const config = await response.json();
    document.documentElement.dataset.ai = config.aiEnabled ? "enabled" : "disabled";
  } catch {
    document.documentElement.dataset.ai = "offline";
  }
}

async function loadCollections() {
  try {
    const [notebooksPayload, tagsPayload] = await Promise.all([
      requestJson("/api/notebooks"),
      requestJson("/api/tags")
    ]);
    state.notebooks = notebooksPayload.notebooks || [];
    state.tags = tagsPayload.tags || [];
    writeCache(cacheKeys.collections, {
      notebooks: state.notebooks,
      tags: state.tags,
      cachedAt: new Date().toISOString()
    });
    renderCollections();
  } catch {
    const cached = readCache(cacheKeys.collections, null);
    if (cached) {
      state.notebooks = cached.notebooks || [];
      state.tags = cached.tags || [];
      setCacheStatus("Collections cached", `From ${formatDate(cached.cachedAt)}`);
    }
    renderCollections();
  }
}

async function loadNotes() {
  const params = new URLSearchParams();
  const search = elements.search.value.trim();
  if (search) params.set("q", search);

  try {
    const payload = await requestJson(`/api/notes${params.size ? `?${params}` : ""}`);
    state.notes = payload.notes || [];
    writeCache(cacheKeys.notes, {
      notes: state.notes,
      cachedAt: new Date().toISOString()
    });
    renderNotes();
    if (state.notes.length && !state.selectedId && !state.localDraftRestored) {
      const cachedSelectedId = readCache(cacheKeys.selectedId, null);
      const selected = state.notes.find((note) => note.id === cachedSelectedId) || state.notes[0];
      selectNote(selected);
    }
    if (!state.notes.length && !state.localDraftRestored) {
      setStatus("Ready for first note");
    }
    setCacheStatus("Synced locally", `${state.notes.length} notes cached`);
  } catch (error) {
    const cached = readCache(cacheKeys.notes, null);
    if (cached?.notes?.length) {
      state.notes = cached.notes;
      renderNotes();
      if (!state.selectedId) {
        const cachedSelectedId = readCache(cacheKeys.selectedId, null);
        const selected = state.notes.find((note) => note.id === cachedSelectedId) || state.notes[0];
        selectNote(selected);
      }
      setStatus("Loaded cached notes while database is offline");
      setCacheStatus("Offline cache", `From ${formatDate(cached.cachedAt)}`);
      return;
    }

    elements.list.innerHTML = `
      <article class="note-card active">
        <span class="tag warm">Setup</span>
        <h2>Database not connected</h2>
        <p>${escapeHtml(error.message)}</p>
        <footer>
          <span>MySQL</span>
          <span>${error.status || "offline"}</span>
        </footer>
      </article>
    `;
    restoreDraftCache();
    setStatus("Database setup needed");
    setCacheStatus("Local only", "Drafts still cache here");
  }
}

async function loadAttachments(noteId = state.selectedId) {
  if (!noteId) {
    state.attachments = [];
    renderAttachments();
    return;
  }

  try {
    const payload = await requestJson(`/api/notes/${noteId}/attachments`);
    state.attachments = payload.attachments || [];
  } catch {
    state.attachments = [];
  }
  renderAttachments();
}

async function saveNote() {
  if (state.pendingSave) return;
  state.pendingSave = true;
  elements.saveNote.textContent = "Saving";
  setStatus("Saving...");

  try {
    const draft = currentDraft();
    const payload = state.selectedId
      ? await requestJson(`/api/notes/${state.selectedId}`, {
        method: "PUT",
        body: JSON.stringify(draft)
      })
      : await requestJson("/api/notes", {
        method: "POST",
        body: JSON.stringify(draft)
      });

    const saved = payload.note;
    const index = state.notes.findIndex((note) => note.id === saved.id);
    if (index >= 0) {
      state.notes[index] = saved;
    } else {
      state.notes.unshift(saved);
    }
    selectNote(saved);
    state.localDraftRestored = false;
    clearDraftCache();
    writeCache(cacheKeys.notes, {
      notes: state.notes,
      cachedAt: new Date().toISOString()
    });
    await loadCollections();
    setStatus(`Saved ${formatDate(saved.updatedAt)}`);
    setCacheStatus("Synced locally", "Server note cached");
    return saved;
  } catch (error) {
    setStatus(error.message);
    saveDraftCache();
    return null;
  } finally {
    state.pendingSave = false;
    elements.saveNote.textContent = "Sync";
  }
}

async function uploadAttachment() {
  let noteId = state.selectedId;
  const file = elements.attachmentFile.files?.[0];
  if (!file) {
    setStatus("Choose a file first");
    return;
  }

  if (!noteId) {
    const saved = await saveNote();
    noteId = saved?.id;
  }

  if (!noteId) {
    setStatus("Save the note before uploading attachments");
    return;
  }

  const form = new FormData();
  form.append("file", file);
  elements.uploadAttachment.textContent = "Uploading";

  try {
    const response = await fetch(`/api/notes/${noteId}/attachments`, {
      method: "POST",
      body: form
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || payload.error || "Upload failed");
    }
    state.attachments.unshift(payload.attachment);
    elements.attachmentFile.value = "";
    renderAttachments();
    setStatus(`Attached ${payload.attachment.filename}`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    elements.uploadAttachment.textContent = "Upload";
  }
}

async function runAiAction(action) {
  let noteId = state.selectedId;
  if (!noteId) {
    const saved = await saveNote();
    noteId = saved?.id;
  }

  if (!noteId) {
    elements.aiResult.textContent = "Save the note before running AI.";
    return;
  }

  elements.aiResult.textContent = "Thinking...";

  try {
    const payload = await requestJson(`/api/notes/${noteId}/ai/${action}`, {
      method: "POST",
      body: JSON.stringify({})
    });
    renderAiOutput(payload);

    if (action === "suggest-tags" && payload.output?.tags?.length) {
      elements.tags.value = payload.output.tags.join(", ");
      saveDraftCache();
    }

    if (action === "create-title" && payload.output?.title) {
      elements.title.value = payload.output.title;
      saveDraftCache();
    }
  } catch (error) {
    elements.aiResult.textContent = error.message;
  }
}

function bindEvents() {
  elements.newNote.addEventListener("click", () => {
    state.localDraftRestored = true;
    state.selectedId = null;
    elements.notebook.value = state.notebooks[0]?.id || "";
    elements.tags.value = "";
    elements.title.value = "Untitled note";
    elements.body.value = "";
    setStatus("New draft");
    renderNotes();
    elements.title.focus();
  });

  elements.saveNote.addEventListener("click", saveNote);
  elements.uploadAttachment.addEventListener("click", uploadAttachment);
  elements.aiActions.forEach((button) => {
    button.addEventListener("click", () => runAiAction(button.dataset.aiAction));
  });

  elements.exportJson.addEventListener("click", () => {
    window.location.href = "/api/export.json";
  });

  elements.exportMarkdown.addEventListener("click", () => {
    window.location.href = "/api/export.md";
  });

  elements.title.addEventListener("input", saveDraftCache);
  elements.body.addEventListener("input", saveDraftCache);
  elements.notebook.addEventListener("change", saveDraftCache);
  elements.tags.addEventListener("input", saveDraftCache);

  elements.search.addEventListener("input", () => {
    window.clearTimeout(elements.search.searchTimer);
    elements.search.searchTimer = window.setTimeout(loadNotes, 250);
  });

  elements.list.addEventListener("click", (event) => {
    const card = event.target.closest("[data-note-id]");
    if (!card) return;
    const note = state.notes.find((item) => item.id === Number(card.dataset.noteId));
    if (note) selectNote(note);
  });
}

async function init() {
  bindEvents();
  hydrateConfig();
  await loadCollections();
  const restoredDraft = restoreDraftCache();
  await loadNotes();
  if (restoredDraft) {
    setCacheStatus("Draft restored", "Sync when ready");
  }
}

init();
