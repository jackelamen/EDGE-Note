const cacheKeys = {
  draft: "edge_note_draft_v1",
  notes: "edge_note_notes_v1",
  collections: "edge_note_collections_v1",
  pendingChanges: "edge_note_pending_changes_v1",
  selectedId: "edge_note_selected_note_v1"
};

const state = {
  attachments: [],
  attachmentLimitMb: 25,
  authMode: "login",
  filter: "all",
  notebooks: [],
  notebookFilter: null,
  notes: [],
  tagFilter: null,
  tags: [],
  localDraftRestored: false,
  selectedId: null,
  pendingSave: false
};

let pendingSyncTimer = null;

const elements = {
  attachmentFile: document.querySelector("[data-attachment-file]"),
  attachmentLimit: document.querySelector("[data-attachment-limit]"),
  attachmentList: document.querySelector("[data-attachments-list]"),
  appShell: document.querySelector("[data-app-shell]"),
  authForm: document.querySelector("[data-auth-form]"),
  authMessage: document.querySelector("[data-auth-message]"),
  authMode: document.querySelector("[data-auth-mode]"),
  authPanel: document.querySelector("[data-auth-panel]"),
  authPassword: document.querySelector("[data-auth-password]"),
  authSubmit: document.querySelector("[data-auth-submit]"),
  setupHelp: document.querySelector("[data-setup-help]"),
  aiActions: document.querySelectorAll("[data-ai-action]"),
  aiResult: document.querySelector("[data-ai-result]"),
  body: document.querySelector("[data-note-body]"),
  cacheStatus: document.querySelector("[data-cache-status]"),
  cacheTitle: document.querySelector("[data-cache-title]"),
  exportJson: document.querySelector("[data-export='json']"),
  exportArchive: document.querySelector("[data-export='archive']"),
  exportMarkdown: document.querySelector("[data-export='markdown']"),
  list: document.querySelector("[data-notes-list]"),
  listEyebrow: document.querySelector("[data-list-eyebrow]"),
  listTitle: document.querySelector("[data-list-title]"),
  mainNav: document.querySelector("[data-main-nav]"),
  markdownPreview: document.querySelector("[data-markdown-preview]"),
  meta: document.querySelector("[data-note-meta]"),
  newNote: document.querySelector("[data-action='new-note']"),
  notebook: document.querySelector("[data-note-notebook]"),
  notebookForm: document.querySelector("[data-notebook-form]"),
  notebookName: document.querySelector("[data-notebook-name]"),
  notebooksList: document.querySelector("[data-notebooks-list]"),
  currentPassword: document.querySelector("[data-current-password]"),
  logout: document.querySelector("[data-action='logout']"),
  newPassword: document.querySelector("[data-new-password]"),
  passwordForm: document.querySelector("[data-password-form]"),
  passwordStatus: document.querySelector("[data-password-status]"),
  saveNote: document.querySelector("[data-action='save-note']"),
  search: document.querySelector("[data-notes-search]"),
  tags: document.querySelector("[data-note-tags]"),
  tagsList: document.querySelector("[data-tags-list]"),
  tagsNav: document.querySelector("[data-tags-nav]"),
  taskList: document.querySelector("[data-task-list]"),
  taskSummary: document.querySelector("[data-task-summary]"),
  title: document.querySelector("[data-note-title]"),
  archiveNote: document.querySelector("[data-action='archive-note']"),
  deleteNote: document.querySelector("[data-action='delete-note']"),
  formatButtons: document.querySelectorAll("[data-format]"),
  historyList: document.querySelector("[data-history-list]"),
  togglePreview: document.querySelector("[data-action='toggle-preview']"),
  toggleFavorite: document.querySelector("[data-action='toggle-favorite']"),
  insertChecklist: document.querySelector("[data-action='insert-checklist']"),
  uploadAttachment: document.querySelector("[data-action='upload-attachment']")
};

function showApp() {
  elements.authPanel.hidden = true;
  elements.appShell.hidden = false;
}

function showAuth({ disabled = false, setupRequired = false, message = "" } = {}) {
  state.authMode = setupRequired ? "setup" : "login";
  elements.appShell.hidden = true;
  elements.authPanel.hidden = false;
  elements.authMode.textContent = setupRequired ? "Set owner password" : "Private access";
  elements.authSubmit.textContent = setupRequired ? "Set password" : "Log in";
  elements.authPassword.autocomplete = setupRequired ? "new-password" : "current-password";
  elements.authMessage.textContent = message;
  elements.authPassword.disabled = disabled;
  elements.authSubmit.disabled = disabled;
  elements.setupHelp.hidden = !disabled;
  if (!disabled) {
    elements.authPassword.focus();
  }
}

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

function currentNote() {
  return state.notes.find((note) => note.id === state.selectedId) || null;
}

function splitTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isSafeUrl(value) {
  try {
    const url = new URL(value, window.location.origin);
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function renderInlineMarkdown(value) {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)]\(([^)\s]+)\)/g, (match, text, url) => (
    isSafeUrl(url) ? `<a href="${escapeHtml(url)}">${text}</a>` : match
  ));
  return html;
}

function renderMarkdown(body) {
  const lines = String(body || "").split("\n");
  const output = [];
  let listOpen = false;

  function closeList() {
    if (listOpen) {
      output.push("</ul>");
      listOpen = false;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length + 1;
      output.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const quote = trimmed.match(/^>\s+(.+)$/);
    if (quote) {
      closeList();
      output.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    const listItem = trimmed.match(/^-\s+(?:\[([ xX])]\s+)?(.+)$/);
    if (listItem) {
      if (!listOpen) {
        output.push("<ul>");
        listOpen = true;
      }
      const checked = listItem[1]?.toLowerCase() === "x";
      const checkbox = listItem[1] ? `<span class="preview-check">${checked ? "[x]" : "[ ]"}</span>` : "";
      output.push(`<li class="${checked ? "complete" : ""}">${checkbox}${renderInlineMarkdown(listItem[2])}</li>`);
      continue;
    }

    closeList();
    output.push(`<p>${renderInlineMarkdown(trimmed)}</p>`);
  }

  closeList();
  return output.join("") || '<p class="empty-state">Nothing to preview yet.</p>';
}

function parseChecklistTasks(body) {
  return String(body || "")
    .split("\n")
    .map((line, index) => {
      const match = line.match(/^(\s*)-\s+\[([ xX])]\s+(.*)$/);
      if (!match) return null;
      return {
        lineIndex: index,
        checked: match[2].toLowerCase() === "x",
        text: match[3].trim() || "Untitled task"
      };
    })
    .filter(Boolean);
}

function currentDraft() {
  const note = currentNote();
  return {
    notebookId: elements.notebook.value ? Number(elements.notebook.value) : null,
    title: elements.title.value,
    body: elements.body.value,
    bodyFormat: "markdown",
    favorite: note?.favorite || false,
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

function pendingChanges() {
  return readCache(cacheKeys.pendingChanges, []);
}

function writePendingChanges(changes) {
  writeCache(cacheKeys.pendingChanges, changes);
  setCacheStatus(changes.length ? "Sync queued" : "Synced locally", changes.length ? `${changes.length} pending changes` : `${state.notes.length} notes cached`);
}

function queuePendingChange(change) {
  const changes = pendingChanges();
  changes.push({
    clientId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    queuedAt: new Date().toISOString(),
    ...change
  });
  writePendingChanges(changes);
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
  renderTasks();
  renderPreview();
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
  renderTasks();
  renderPreview();
  renderEditorActions(note);
  if (note?.id) {
    writeCache(cacheKeys.selectedId, note.id);
    loadAttachments(note.id);
    loadHistory(note.id);
  } else {
    state.attachments = [];
    renderAttachments();
    renderHistory([]);
  }
  renderNotes();
}

function renderEditorActions(note = currentNote()) {
  const hasSavedNote = Boolean(note?.id);
  elements.toggleFavorite.classList.toggle("active", Boolean(note?.favorite));
  elements.toggleFavorite.setAttribute("aria-pressed", note?.favorite ? "true" : "false");
  elements.archiveNote.textContent = note?.archivedAt ? "Restore" : "Archive";
  elements.toggleFavorite.disabled = !hasSavedNote;
  elements.archiveNote.disabled = !hasSavedNote;
  elements.deleteNote.disabled = !hasSavedNote;
}

function viewLabel() {
  if (state.notebookFilter) {
    const notebook = state.notebooks.find((item) => item.id === state.notebookFilter);
    return notebook?.name || "Notebook";
  }

  if (state.tagFilter) {
    return `#${state.tagFilter}`;
  }

  return {
    all: "All notes",
    favorites: "Favorites",
    tasks: "Tasks",
    archive: "Archive"
  }[state.filter] || "All notes";
}

function visibleNotes() {
  return state.notes.filter((note) => {
    if (state.notebookFilter && note.notebookId !== state.notebookFilter) return false;
    if (state.tagFilter && !note.tags?.includes(state.tagFilter)) return false;
    if (state.filter === "archive") return Boolean(note.archivedAt);
    if (note.archivedAt) return false;
    if (state.filter === "favorites") return note.favorite;
    if (state.filter === "tasks") return parseChecklistTasks(note.body).length > 0;
    return true;
  });
}

function updateNavigationState() {
  elements.listTitle.textContent = viewLabel();
  elements.listEyebrow.textContent = state.notebookFilter ? "Notebook" : state.tagFilter ? "Tag" : "Notes";

  elements.mainNav.querySelectorAll("[data-view-filter]").forEach((link) => {
    link.classList.toggle("active", !state.notebookFilter && !state.tagFilter && link.dataset.viewFilter === state.filter);
  });

  elements.notebooksList.querySelectorAll("[data-notebook-filter]").forEach((link) => {
    link.classList.toggle("active", Number(link.dataset.notebookFilter) === state.notebookFilter);
  });

  elements.tagsNav.querySelectorAll("[data-tag-filter]").forEach((link) => {
    link.classList.toggle("active", link.dataset.tagFilter === state.tagFilter);
  });
}

function renderTasks() {
  const tasks = parseChecklistTasks(elements.body.value);
  const complete = tasks.filter((task) => task.checked).length;
  elements.taskSummary.textContent = tasks.length
    ? `${complete} of ${tasks.length} complete`
    : "No checklist items";

  if (!tasks.length) {
    elements.taskList.innerHTML = '<div class="empty-state">Add checklist lines to track tasks in this note.</div>';
    return;
  }

  elements.taskList.innerHTML = tasks.map((task) => `
    <button class="task-item ${task.checked ? "complete" : ""}" type="button" data-task-line="${task.lineIndex}">
      <span aria-hidden="true">${task.checked ? "[x]" : "[ ]"}</span>
      <span>${escapeHtml(task.text)}</span>
    </button>
  `).join("");
}

function renderPreview() {
  elements.markdownPreview.innerHTML = renderMarkdown(elements.body.value);
}

function insertChecklistItem() {
  const textarea = elements.body;
  const { selectionStart, selectionEnd, value } = textarea;
  const needsLeadingLine = selectionStart > 0 && value[selectionStart - 1] !== "\n";
  const needsTrailingLine = selectionEnd < value.length && value[selectionEnd] !== "\n";
  const insertion = `${needsLeadingLine ? "\n" : ""}- [ ] ${needsTrailingLine ? "\n" : ""}`;

  textarea.setRangeText(insertion, selectionStart, selectionEnd, "end");
  const cursorOffset = needsTrailingLine ? insertion.length - 1 : insertion.length;
  textarea.selectionStart = selectionStart + cursorOffset;
  textarea.selectionEnd = textarea.selectionStart;
  textarea.focus();
  saveDraftCache();
  renderTasks();
  renderPreview();
}

function toggleTaskLine(lineIndex) {
  const lines = elements.body.value.split("\n");
  const line = lines[lineIndex];
  if (!line) return;

  lines[lineIndex] = line.replace(/^(\s*-\s+\[)([ xX])(\]\s+.*)$/, (_, prefix, checked, suffix) => (
    `${prefix}${checked.toLowerCase() === "x" ? " " : "x"}${suffix}`
  ));
  elements.body.value = lines.join("\n");
  saveDraftCache();
  renderTasks();
  renderPreview();
}

function applyMarkdownFormat(format) {
  const textarea = elements.body;
  const { selectionStart, selectionEnd, value } = textarea;
  const selected = value.slice(selectionStart, selectionEnd);
  const fallback = {
    heading: "Heading",
    bold: "bold text",
    italic: "italic text",
    bullet: "List item",
    quote: "Quoted text",
    code: "code",
    link: "link text"
  }[format] || "";
  const text = selected || fallback;
  const replacements = {
    heading: `## ${text}`,
    bold: `**${text}**`,
    italic: `*${text}*`,
    bullet: `- ${text}`,
    quote: `> ${text}`,
    code: `\`${text}\``,
    link: `[${text}](https://)`
  };
  const replacement = replacements[format] || text;
  const needsLeadingLine = ["heading", "bullet", "quote"].includes(format)
    && selectionStart > 0
    && value[selectionStart - 1] !== "\n";
  const insertion = `${needsLeadingLine ? "\n" : ""}${replacement}`;

  textarea.setRangeText(insertion, selectionStart, selectionEnd, "select");
  textarea.focus();
  saveDraftCache();
  renderTasks();
  renderPreview();
}

function togglePreview() {
  const showing = elements.markdownPreview.hidden;
  elements.markdownPreview.hidden = !showing;
  elements.body.hidden = showing;
  elements.togglePreview.classList.toggle("active", showing);
  elements.togglePreview.textContent = showing ? "Write" : "Preview";
  if (showing) {
    renderPreview();
  } else {
    elements.body.focus();
  }
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
    <article class="attachment-item">
      <a class="attachment-main" href="${attachment.downloadUrl}">
        ${attachment.thumbnailUrl ? `<img src="${attachment.thumbnailUrl}" alt="">` : '<span class="attachment-icon" aria-hidden="true">FILE</span>'}
        <span>${escapeHtml(attachment.filename)}</span>
        <small>${escapeHtml(attachment.mimeType || "file")} · ${escapeHtml(formatBytes(attachment.sizeBytes))}</small>
      </a>
      <div class="attachment-tools">
        <button type="button" data-attachment-replace="${attachment.id}">Replace</button>
        <button type="button" data-attachment-delete="${attachment.id}">Delete</button>
      </div>
    </article>
  `).join("");
}

function historyPreview(version) {
  const preview = String(version.body || "").replace(/\s+/g, " ").trim();
  return preview.slice(0, 120) || "No body";
}

function renderHistory(versions) {
  if (!versions.length) {
    elements.historyList.innerHTML = '<div class="empty-state">Save edits to build version history.</div>';
    return;
  }

  elements.historyList.innerHTML = versions.map((version) => `
    <article class="history-item">
      <div>
        <strong>${escapeHtml(version.title || "Untitled note")}</strong>
        <span>${escapeHtml(formatDate(version.createdAt))}</span>
        <p>${escapeHtml(historyPreview(version))}</p>
      </div>
      <button type="button" data-version-restore="${version.id}">Restore</button>
    </article>
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
  elements.tagsNav.innerHTML = `
    <h2 id="tags-heading">Tags</h2>
    ${state.tags.length ? state.tags.map((tag) => `
      <a href="#tag-${escapeHtml(tag.name)}" data-tag-filter="${escapeHtml(tag.name)}">
        #${escapeHtml(tag.name)}
        <span>${tag.noteCount || 0}</span>
      </a>
    `).join("") : '<a href="#tags">No tags yet</a>'}
  `;
  elements.tagsList.innerHTML = state.tags.map((tag) => (
    `<option value="${escapeHtml(tag.name)}"></option>`
  )).join("");
  updateNavigationState();
}

function renderNotes() {
  const notes = visibleNotes();
  updateNavigationState();

  if (!notes.length) {
    elements.list.innerHTML = `
      <article class="note-card active">
        <span class="tag">Empty</span>
        <h2>No matching notes</h2>
        <p>Create a note or switch views to see more.</p>
        <footer>
          <span>Ready</span>
          <span>${escapeHtml(viewLabel())}</span>
        </footer>
      </article>
    `;
    return;
  }

  elements.list.innerHTML = notes.map((note) => `
    <article class="note-card ${note.id === state.selectedId ? "active" : ""}" data-note-id="${note.id}">
      <span class="tag">${escapeHtml(note.favorite ? "Favorite" : note.tags?.[0] || note.notebookName || "Note")}</span>
      <h2>${escapeHtml(note.title || "Untitled note")}</h2>
      <p>${escapeHtml(notePreview(note))}</p>
      <footer>
        <span>${escapeHtml(formatDate(note.updatedAt))}</span>
        <span>v${note.syncVersion || 1}</span>
      </footer>
    </article>
  `).join("");
}

async function updateCurrentNote(patch) {
  const note = currentNote();
  if (!note) {
    setStatus("Save the note before changing note actions");
    return null;
  }

  const payload = await requestJson(`/api/notes/${note.id}`, {
    method: "PUT",
    body: JSON.stringify({
      notebookId: elements.notebook.value ? Number(elements.notebook.value) : null,
      title: elements.title.value,
      body: elements.body.value,
      bodyFormat: "markdown",
      tags: splitTags(elements.tags.value),
      favorite: patch.favorite ?? note.favorite
    })
  });
  const updated = payload.note;
  const index = state.notes.findIndex((item) => item.id === updated.id);
  if (index >= 0) state.notes[index] = updated;
  selectNote(updated);
  writeCache(cacheKeys.notes, {
    notes: state.notes,
    cachedAt: new Date().toISOString()
  });
  return updated;
}

async function toggleFavoriteNote() {
  const note = currentNote();
  const updated = await updateCurrentNote({ favorite: !note?.favorite });
  if (updated) {
    setStatus(updated.favorite ? "Added to favorites" : "Removed from favorites");
  }
}

async function archiveCurrentNote() {
  const note = currentNote();
  if (!note) {
    setStatus("Save the note before archiving");
    return;
  }

  const action = note.archivedAt ? "restore" : "archive";
  const payload = await requestJson(`/api/notes/${note.id}/${action}`, {
    method: "POST",
    body: JSON.stringify({})
  });
  const updated = payload.note;
  const index = state.notes.findIndex((item) => item.id === updated.id);
  if (index >= 0) state.notes[index] = updated;
  selectNote(updated);
  setStatus(action === "archive" ? "Archived" : "Restored");
}

async function deleteCurrentNote() {
  const note = currentNote();
  if (!note) {
    setStatus("No saved note to delete");
    return;
  }

  if (!window.confirm(`Delete "${note.title || "Untitled note"}"?`)) return;

  await requestJson(`/api/notes/${note.id}`, {
    method: "DELETE",
    body: JSON.stringify({})
  });
  state.notes = state.notes.filter((item) => item.id !== note.id);
  state.selectedId = null;
  clearDraftCache();
  renderHistory([]);
  writeCache(cacheKeys.notes, {
    notes: state.notes,
    cachedAt: new Date().toISOString()
  });
  selectNote(visibleNotes()[0] || null);
  setStatus("Deleted");
}

async function restoreVersion(versionId) {
  const note = currentNote();
  if (!note) {
    setStatus("Select a saved note before restoring history");
    return;
  }

  if (!window.confirm("Restore this version? Your current version will be saved to history first.")) return;

  const payload = await requestJson(`/api/notes/${note.id}/versions/${versionId}/restore`, {
    method: "POST",
    body: JSON.stringify({})
  });
  const restored = payload.note;
  const index = state.notes.findIndex((item) => item.id === restored.id);
  if (index >= 0) state.notes[index] = restored;
  selectNote(restored);
  writeCache(cacheKeys.notes, {
    notes: state.notes,
    cachedAt: new Date().toISOString()
  });
  setStatus("Version restored");
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
    error.auth = payload.auth;
    if (response.status === 401 && payload.auth) {
      showAuth({ setupRequired: payload.auth.setupRequired, message: error.message });
    }
    throw error;
  }

  return payload;
}

async function checkAuth() {
  try {
    const status = await requestJson("/api/auth/status");
    if (status.authenticated) {
      showApp();
      return true;
    }
    showAuth({ setupRequired: status.setupRequired });
  } catch (error) {
    showAuth({
      disabled: error.status === 503,
      setupRequired: error.auth?.setupRequired,
      message: error.status === 503 ? "Database setup required before login." : error.message
    });
  }
  return false;
}

async function submitAuth(event) {
  event.preventDefault();
  const password = elements.authPassword.value;
  elements.authSubmit.textContent = state.authMode === "setup" ? "Setting..." : "Logging in...";
  elements.authMessage.textContent = "";

  try {
    await requestJson(state.authMode === "setup" ? "/api/auth/setup" : "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password })
    });
    elements.authPassword.value = "";
    showApp();
    await loadCollections();
    await loadNotes();
  } catch (error) {
    elements.authMessage.textContent = error.message;
  } finally {
    elements.authSubmit.textContent = state.authMode === "setup" ? "Set password" : "Log in";
  }
}

async function logout() {
  await requestJson("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({})
  }).catch(() => {});
  showAuth({ message: "Logged out." });
}

async function changePassword(event) {
  event.preventDefault();
  elements.passwordStatus.textContent = "Changing...";

  try {
    const payload = await requestJson("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: elements.currentPassword.value,
        newPassword: elements.newPassword.value
      })
    });
    elements.currentPassword.value = "";
    elements.newPassword.value = "";
    elements.passwordStatus.textContent = payload.message || "Password changed.";
    showAuth({ message: "Password changed. Log in again." });
  } catch (error) {
    elements.passwordStatus.textContent = error.message;
  }
}

async function hydrateConfig() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) return;
    const config = await response.json();
    document.documentElement.dataset.ai = config.aiEnabled ? "enabled" : "disabled";
    state.attachmentLimitMb = config.attachmentLimitMb || 25;
    elements.attachmentLimit.textContent = `Limit ${state.attachmentLimitMb} MB`;
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

async function createNotebookFromForm(event) {
  event.preventDefault();
  const name = elements.notebookName.value.trim();
  if (!name) return;

  try {
    const payload = await requestJson("/api/notebooks", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    state.notebooks = payload.notebooks || [];
    elements.notebookName.value = "";
    const created = state.notebooks.find((notebook) => notebook.name.toLowerCase() === name.toLowerCase());
    if (created) {
      state.notebookFilter = created.id;
      state.tagFilter = null;
      state.filter = "all";
      elements.notebook.value = created.id;
    }
    writeCache(cacheKeys.collections, {
      notebooks: state.notebooks,
      tags: state.tags,
      cachedAt: new Date().toISOString()
    });
    renderCollections();
    renderNotes();
    setStatus(`Notebook "${name}" ready`);
  } catch (error) {
    setStatus(error.message);
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

async function flushPendingChanges() {
  const changes = pendingChanges();
  if (!changes.length) return;

  try {
    const payload = await requestJson("/api/sync/push", {
      method: "POST",
      body: JSON.stringify({ changes })
    });
    const conflicts = payload.results?.filter((result) => result.status === "conflict") || [];
    const failed = payload.results?.filter((result) => !["applied", "conflict"].includes(result.status)) || [];
    const retryClientIds = new Set([...conflicts, ...failed].map((result) => result.clientId));
    const retryChanges = changes.filter((change) => retryClientIds.has(change.clientId));
    writePendingChanges(retryChanges);

    if (conflicts.length) {
      setStatus(`${conflicts.length} sync conflict${conflicts.length === 1 ? "" : "s"} need review`);
      elements.aiResult.textContent = conflicts.map((conflict) => (
        `Conflict: ${conflict.serverNote?.title || "Untitled note"}\nServer version ${conflict.serverNote?.syncVersion || "unknown"} changed before this edit synced.`
      )).join("\n\n");
      return;
    }

    if (payload.accepted) {
      await loadNotes();
      setStatus(`Synced ${payload.accepted} queued change${payload.accepted === 1 ? "" : "s"}`);
    }
  } catch {
    writePendingChanges(changes);
  }
}

function schedulePendingSync() {
  window.clearTimeout(pendingSyncTimer);
  pendingSyncTimer = window.setTimeout(flushPendingChanges, 500);
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

async function loadHistory(noteId = state.selectedId) {
  if (!noteId) {
    renderHistory([]);
    return;
  }

  try {
    const payload = await requestJson(`/api/notes/${noteId}/versions`);
    renderHistory(payload.versions || []);
  } catch {
    renderHistory([]);
  }
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
    await loadHistory(saved.id);
    setStatus(`Saved ${formatDate(saved.updatedAt)}`);
    setCacheStatus("Synced locally", "Server note cached");
    return saved;
  } catch (error) {
    setStatus(error.message);
    queuePendingChange({
      entityType: "note",
      action: state.selectedId ? "update" : "create",
      entityId: state.selectedId,
      baseSyncVersion: currentNote()?.syncVersion,
      data: currentDraft()
    });
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
  if (file.size > state.attachmentLimitMb * 1024 * 1024) {
    setStatus(`Attachment exceeds ${state.attachmentLimitMb} MB`);
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

async function replaceSelectedAttachment(attachmentId) {
  const file = elements.attachmentFile.files?.[0];
  if (!file) {
    setStatus("Choose a replacement file first");
    return;
  }
  if (file.size > state.attachmentLimitMb * 1024 * 1024) {
    setStatus(`Attachment exceeds ${state.attachmentLimitMb} MB`);
    return;
  }

  const form = new FormData();
  form.append("file", file);
  setStatus("Replacing attachment...");

  try {
    const response = await fetch(`/api/attachments/${attachmentId}`, {
      method: "PUT",
      body: form
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || payload.error || "Replace failed");
    }
    state.attachments = state.attachments.map((attachment) => (
      attachment.id === attachmentId ? payload.attachment : attachment
    ));
    elements.attachmentFile.value = "";
    renderAttachments();
    setStatus(`Replaced ${payload.attachment.filename}`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function deleteSelectedAttachment(attachmentId) {
  const attachment = state.attachments.find((item) => item.id === attachmentId);
  if (!attachment) return;
  if (!window.confirm(`Delete "${attachment.filename}"?`)) return;

  try {
    await requestJson(`/api/attachments/${attachmentId}`, {
      method: "DELETE",
      body: JSON.stringify({})
    });
    state.attachments = state.attachments.filter((item) => item.id !== attachmentId);
    renderAttachments();
    setStatus(`Deleted ${attachment.filename}`);
  } catch (error) {
    setStatus(error.message);
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
  elements.authForm.addEventListener("submit", submitAuth);
  elements.logout.addEventListener("click", logout);
  elements.notebookForm.addEventListener("submit", createNotebookFromForm);

  elements.newNote.addEventListener("click", () => {
    state.localDraftRestored = true;
    state.selectedId = null;
    elements.notebook.value = state.notebookFilter || state.notebooks[0]?.id || "";
    elements.tags.value = "";
    elements.title.value = "Untitled note";
    elements.body.value = "";
    setStatus("New draft");
    renderTasks();
    renderPreview();
    renderEditorActions(null);
    renderNotes();
    elements.title.focus();
  });

  elements.insertChecklist.addEventListener("click", insertChecklistItem);
  elements.formatButtons.forEach((button) => {
    button.addEventListener("click", () => applyMarkdownFormat(button.dataset.format));
  });
  elements.togglePreview.addEventListener("click", togglePreview);
  elements.toggleFavorite.addEventListener("click", toggleFavoriteNote);
  elements.archiveNote.addEventListener("click", archiveCurrentNote);
  elements.deleteNote.addEventListener("click", deleteCurrentNote);
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

  elements.exportArchive.addEventListener("click", () => {
    window.location.href = "/api/export.tgz";
  });

  elements.passwordForm.addEventListener("submit", changePassword);

  elements.title.addEventListener("input", saveDraftCache);
  elements.body.addEventListener("input", () => {
    saveDraftCache();
    renderTasks();
    renderPreview();
  });
  elements.notebook.addEventListener("change", saveDraftCache);
  elements.tags.addEventListener("input", saveDraftCache);

  elements.search.addEventListener("input", () => {
    window.clearTimeout(elements.search.searchTimer);
    elements.search.searchTimer = window.setTimeout(loadNotes, 250);
  });

  elements.mainNav.addEventListener("click", (event) => {
    const link = event.target.closest("[data-view-filter]");
    if (!link) return;
    event.preventDefault();
    state.filter = link.dataset.viewFilter;
    state.notebookFilter = null;
    state.tagFilter = null;
    renderNotes();
  });

  elements.notebooksList.addEventListener("click", (event) => {
    const link = event.target.closest("[data-notebook-filter]");
    if (!link) return;
    event.preventDefault();
    state.notebookFilter = Number(link.dataset.notebookFilter);
    state.tagFilter = null;
    state.filter = "all";
    renderNotes();
  });

  elements.tagsNav.addEventListener("click", (event) => {
    const link = event.target.closest("[data-tag-filter]");
    if (!link) return;
    event.preventDefault();
    state.tagFilter = link.dataset.tagFilter;
    state.notebookFilter = null;
    state.filter = "all";
    renderNotes();
  });

  elements.list.addEventListener("click", (event) => {
    const card = event.target.closest("[data-note-id]");
    if (!card) return;
    const note = state.notes.find((item) => item.id === Number(card.dataset.noteId));
    if (note) selectNote(note);
  });

  elements.taskList.addEventListener("click", (event) => {
    const task = event.target.closest("[data-task-line]");
    if (!task) return;
    toggleTaskLine(Number(task.dataset.taskLine));
  });

  elements.attachmentList.addEventListener("click", (event) => {
    const replace = event.target.closest("[data-attachment-replace]");
    const remove = event.target.closest("[data-attachment-delete]");
    if (replace) {
      replaceSelectedAttachment(Number(replace.dataset.attachmentReplace));
      return;
    }
    if (remove) {
      deleteSelectedAttachment(Number(remove.dataset.attachmentDelete));
    }
  });

  elements.historyList.addEventListener("click", (event) => {
    const restore = event.target.closest("[data-version-restore]");
    if (!restore) return;
    restoreVersion(Number(restore.dataset.versionRestore));
  });

  window.addEventListener("online", schedulePendingSync);
}

async function init() {
  bindEvents();
  hydrateConfig();
  if (!(await checkAuth())) return;
  await loadCollections();
  const restoredDraft = restoreDraftCache();
  await loadNotes();
  schedulePendingSync();
  if (restoredDraft) {
    setCacheStatus("Draft restored", "Sync when ready");
  }
}

init();
