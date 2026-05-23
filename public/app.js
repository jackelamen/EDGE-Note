const cacheKeys = {
  draft: "edge_note_draft_v1",
  notes: "edge_note_notes_v1",
  collections: "edge_note_collections_v1",
  pendingChanges: "edge_note_pending_changes_v1",
  selectedId: "edge_note_selected_note_v1",
  savedSearches: "edge_note_saved_searches_v1",
  contextCollapsed: "edge_note_context_collapsed_v1"
};

const state = {
  attachments: [],
  attachmentLimitMb: 25,
  authMode: "login",
  filter: "home",
  notebooks: [],
  notebookFilter: null,
  notes: [],
  savedSearches: [],
  tagFilter: null,
  tags: [],
  conflicts: [],
  localDraftRestored: false,
  mobilePanel: "home",
  selectedId: null,
  contextCollapsed: localStorage.getItem(cacheKeys.contextCollapsed) === "true",
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
  aiQuestion: document.querySelector("[data-ai-question]"),
  aiResult: document.querySelector("[data-ai-result]"),
  body: document.querySelector("[data-note-body]"),
  cacheStatus: document.querySelector("[data-cache-status]"),
  cacheTitle: document.querySelector("[data-cache-title]"),
  conflictList: document.querySelector("[data-conflict-list]"),
  conflictPanel: document.querySelector("[data-conflict-panel]"),
  backupList: document.querySelector("[data-backup-list]"),
  exportStatus: document.querySelector("[data-export-status]"),
  exportVerify: document.querySelector("[data-export='status']"),
  exportCreateBackup: document.querySelector("[data-export='create-backup']"),
  exportListBackups: document.querySelector("[data-export='list-backups']"),
  exportJson: document.querySelector("[data-export='json']"),
  exportArchive: document.querySelector("[data-export='archive']"),
  exportMarkdown: document.querySelector("[data-export='markdown']"),
  list: document.querySelector("[data-notes-list]"),
  listEyebrow: document.querySelector("[data-list-eyebrow]"),
  listTitle: document.querySelector("[data-list-title]"),
  mainNav: document.querySelector("[data-main-nav]"),
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
  searchSummary: document.querySelector("[data-search-summary]"),
  clearSearch: document.querySelector("[data-action='clear-search']"),
  savedSearchName: document.querySelector("[data-saved-search-name]"),
  savedSearchesList: document.querySelector("[data-saved-searches-list]"),
  savedSearchNameRow: document.querySelector("[data-saved-search-name-row]"),
  saveSearch: document.querySelector("[data-action='save-search']"),
  tags: document.querySelector("[data-note-tags]"),
  tagsList: document.querySelector("[data-tags-list]"),
  tagsNav: document.querySelector("[data-tags-nav]"),
  taskList: document.querySelector("[data-task-list]"),
  taskSummary: document.querySelector("[data-task-summary]"),
  title: document.querySelector("[data-note-title]"),
  archiveNote: document.querySelector("[data-action='archive-note']"),
  deleteNote: document.querySelector("[data-action='delete-note']"),
  toggleContext: document.querySelector("[data-action='toggle-context']"),
  formatButtons: document.querySelectorAll("[data-format]"),
  formatColorInputs: document.querySelectorAll("[data-format-color]"),
  formatSelects: document.querySelectorAll("[data-format-select]"),
  historyList: document.querySelector("[data-history-list]"),
  toggleFavorite: document.querySelector("[data-action='toggle-favorite']"),
  insertChecklist: document.querySelector("[data-action='insert-checklist']"),
  uploadAttachment: document.querySelector("[data-action='upload-attachment']"),
  // New redesign elements
  homeView: document.querySelector("[data-home-view]"),
  homeRecent: document.querySelector("[data-home-recent]"),
  homeNotebooks: document.querySelector("[data-home-notebooks]"),
  homeGreeting: document.querySelector("[data-home-greeting]"),
  floatingToolbar: document.querySelector("[data-floating-toolbar]"),
  editorBreadcrumb: document.querySelector("[data-editor-breadcrumb]"),
  noteListPanel: document.querySelector("[data-note-list-panel]"),
  editorPanel: document.querySelector(".editor"),
  contextPanel: document.querySelector(".context-panel"),
  mobileTabs: document.querySelector("[data-mobile-tabs]"),
  searchBar: document.querySelector("[data-search-bar]"),
  noteListFocusSearch: document.querySelector("[data-action='focus-search']"),
  confirmSaveSearch: document.querySelector("[data-action='confirm-save-search']")
};

const shortcutFormats = {
  b: "bold",
  i: "italic",
  u: "underline"
};

const toolbarFonts = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
};

const safeToolbarFontValues = new Set(Object.values(toolbarFonts).map((value) => value.toLowerCase()));

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

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = String(html || "");
  return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
}

function notePreview(note) {
  const preview = stripHtml(note.body);
  return preview || "No body yet";
}

function searchSnippet(note) {
  const term = elements.search.value.trim().toLowerCase();
  const body = stripHtml(note.body);
  if (!term || !body.toLowerCase().includes(term)) {
    return notePreview(note);
  }

  const index = body.toLowerCase().indexOf(term);
  const start = Math.max(index - 45, 0);
  const end = Math.min(index + term.length + 75, body.length);
  return `${start ? "... " : ""}${body.slice(start, end)}${end < body.length ? " ..." : ""}`;
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

async function createAttachmentThumbnail(file) {
  if (!file?.type?.startsWith("image/")) return null;

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    image.src = imageUrl;
    await loaded;

    const maxSize = 240;
    const scale = Math.min(maxSize / image.naturalWidth, maxSize / image.naturalHeight, 1);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, width, height);

    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/webp", 0.76);
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
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

function sanitizeCssColor(value) {
  const color = String(value || "").trim().toLowerCase();
  if (!color) return "";
  if (/^#[0-9a-f]{3,8}$/.test(color)) return color;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(color)) return color;
  if (color === "transparent") return color;
  return "";
}

function sanitizeCssFontFamily(value) {
  const font = String(value || "").trim();
  if (!font || /[<>;{}]/.test(font) || /url\s*\(/i.test(font)) return "";
  return safeToolbarFontValues.has(font.toLowerCase()) ? font : "";
}

function sanitizeCssFontSize(value) {
  const size = String(value || "").trim().toLowerCase();
  const match = size.match(/^(\d{1,2})px$/);
  if (!match) return "";
  const pixels = Number(match[1]);
  return pixels >= 10 && pixels <= 36 ? `${pixels}px` : "";
}

function sanitizeInlineStyle(element) {
  const declarations = [];
  const color = sanitizeCssColor(element.style.color);
  const backgroundColor = sanitizeCssColor(element.style.backgroundColor);
  const fontFamily = sanitizeCssFontFamily(element.style.fontFamily);
  const fontSize = sanitizeCssFontSize(element.style.fontSize);

  if (color) declarations.push(`color: ${color}`);
  if (backgroundColor) declarations.push(`background-color: ${backgroundColor}`);
  if (fontFamily) declarations.push(`font-family: ${fontFamily}`);
  if (fontSize) declarations.push(`font-size: ${fontSize}`);

  return declarations.join("; ");
}

function sanitizeHtml(html) {
  const root = document.createElement("div");
  root.innerHTML = String(html || "");
  const allowedTags = new Set([
    "a", "blockquote", "br", "code", "div", "em", "h2", "h3", "h4", "hr", "input",
    "li", "ol", "p", "pre", "s", "span", "strong", "sub", "sup", "u", "ul"
  ]);
  const styleAllowedTags = new Set(["blockquote", "div", "h2", "h3", "h4", "li", "p", "span"]);
  const classAllowList = {
    li: new Set(["complete", "task-item"]),
    ul: new Set(["checklist"])
  };

  function unwrap(element) {
    element.replaceWith(...Array.from(element.childNodes));
  }

  function sanitizeElement(element) {
    const tag = element.tagName.toLowerCase();
    Array.from(element.childNodes).forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        sanitizeElement(child);
      } else if (child.nodeType !== Node.TEXT_NODE) {
        child.remove();
      }
    });

    if (tag === "script" || tag === "style" || tag === "iframe" || tag === "object") {
      element.remove();
      return;
    }

    // Remap legacy tags to their semantic equivalents before the allowlist check
    if (tag === "b") { element.outerHTML = `<strong>${element.innerHTML}</strong>`; return; }
    if (tag === "i") { element.outerHTML = `<em>${element.innerHTML}</em>`; return; }
    if (tag === "strike") { element.outerHTML = `<s>${element.innerHTML}</s>`; return; }

    if (!allowedTags.has(tag)) {
      unwrap(element);
      return;
    }

    const safeClasses = classAllowList[tag]
      ? Array.from(element.classList).filter((name) => classAllowList[tag].has(name))
      : [];
    const safeHref = tag === "a" ? element.getAttribute("href") : null;
    const safeStyle = styleAllowedTags.has(tag) ? sanitizeInlineStyle(element) : "";
    const isCheckbox = tag === "input" && element.matches("input[type='checkbox']");
    const isChecked = isCheckbox && element.checked;

    Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));

    if (safeClasses.length) {
      element.className = safeClasses.join(" ");
    }

    if (safeStyle) {
      element.setAttribute("style", safeStyle);
    }

    if (tag === "a") {
      if (safeHref && isSafeUrl(safeHref)) {
        element.setAttribute("href", safeHref);
        element.setAttribute("rel", "noopener noreferrer");
      } else {
        unwrap(element);
      }
      return;
    }

    if (tag === "input") {
      if (!isCheckbox) {
        element.remove();
        return;
      }
      element.setAttribute("type", "checkbox");
      element.setAttribute("data-task-check", "");
      if (isChecked) element.setAttribute("checked", "");
    }
  }

  Array.from(root.childNodes).forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      sanitizeElement(child);
    } else if (child.nodeType !== Node.TEXT_NODE) {
      child.remove();
    }
  });

  return root.innerHTML;
}

function syncEditorCheckboxAttributes(root = elements.body) {
  root.querySelectorAll("input[data-task-check], input[type='checkbox']").forEach((input) => {
    input.setAttribute("type", "checkbox");
    input.setAttribute("data-task-check", "");
    input.toggleAttribute("checked", input.checked);
  });
}

// Converts legacy Markdown body (body_format=markdown) to HTML for display in the WYSIWYG editor.
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

function markdownToHtml(body) {
  const lines = String(body || "").split("\n");
  const output = [];
  let listOpen = false;
  let listOrdered = false;

  function closeList() {
    if (listOpen) {
      output.push(listOrdered ? "</ol>" : "</ul>");
      listOpen = false;
      listOrdered = false;
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

    const checkItem = trimmed.match(/^-\s+\[([ xX])]\s+(.+)$/);
    if (checkItem) {
      if (!listOpen || listOrdered) { closeList(); output.push('<ul class="checklist">'); listOpen = true; listOrdered = false; }
      const checked = checkItem[1].toLowerCase() === "x";
      output.push(`<li class="task-item${checked ? " complete" : ""}"><input type="checkbox"${checked ? " checked" : ""} data-task-check> ${renderInlineMarkdown(checkItem[2])}</li>`);
      continue;
    }

    const bulletItem = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletItem) {
      if (!listOpen || listOrdered) { closeList(); output.push("<ul>"); listOpen = true; listOrdered = false; }
      output.push(`<li>${renderInlineMarkdown(bulletItem[1])}</li>`);
      continue;
    }

    const orderedItem = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedItem) {
      if (!listOpen || !listOrdered) { closeList(); output.push("<ol>"); listOpen = true; listOrdered = true; }
      output.push(`<li>${renderInlineMarkdown(orderedItem[1])}</li>`);
      continue;
    }

    if (trimmed === "---" || trimmed === "***") {
      closeList();
      output.push("<hr>");
      continue;
    }

    closeList();
    output.push(`<p>${renderInlineMarkdown(trimmed)}</p>`);
  }

  closeList();
  return output.join("") || "<p></p>";
}

// Parse checklist tasks from the WYSIWYG editor's HTML content.
function parseChecklistTasks(html) {
  const div = document.createElement("div");
  div.innerHTML = String(html || "");
  const tasks = [];
  div.querySelectorAll("li.task-item, li.complete, input[data-task-check]").forEach((el) => {
    // Walk up to find the li if we landed on the checkbox
    const li = el.tagName === "LI" ? el : el.closest("li");
    if (!li) return;
    const checkbox = li.querySelector("input[type='checkbox']");
    const checked = checkbox ? checkbox.checked : li.classList.contains("complete");
    const text = (li.textContent || "").trim().replace(/^\[.\]\s*/, "") || "Untitled task";
    // Avoid duplicates (both li and its checkbox would match)
    if (!tasks.find((t) => t.li === li)) {
      tasks.push({ li, checked, text });
    }
  });
  return tasks;
}

function getEditorHtml() {
  syncEditorCheckboxAttributes();
  const cleanHtml = sanitizeHtml(elements.body.innerHTML || "");
  if (cleanHtml !== elements.body.innerHTML) {
    elements.body.innerHTML = cleanHtml;
  }
  return cleanHtml;
}

function setEditorHtml(html) {
  elements.body.innerHTML = sanitizeHtml(html);
}

function currentDraft() {
  const note = currentNote();
  return {
    notebookId: elements.notebook.value ? Number(elements.notebook.value) : null,
    title: elements.title.value,
    body: getEditorHtml(),
    bodyFormat: "html",
    favorite: note?.favorite || false,
    tags: splitTags(elements.tags.value)
  };
}

function hasMeaningfulDraft() {
  const draft = currentDraft();
  const selected = currentNote();
  const title = String(draft.title || "").trim();
  const bodyText = stripHtml(draft.body);
  const tagText = (draft.tags || []).join(",").trim();

  if (!state.selectedId) {
    return Boolean(title && title !== "Untitled note") || Boolean(bodyText) || Boolean(tagText);
  }

  return title !== String(selected?.title || "").trim()
    || draft.body !== (selected?.body || "")
    || tagText !== (selected?.tags || []).join(",").trim()
    || Number(draft.notebookId || 0) !== Number(selected?.notebookId || 0);
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

function hasUnsyncedWork() {
  return state.pendingSave || Boolean(pendingChanges().length) || hasMeaningfulDraft();
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

function removePendingChange(clientId) {
  const nextChanges = pendingChanges().filter((change) => change.clientId !== clientId);
  writePendingChanges(nextChanges);
}

function conflictPreview(value) {
  return String(value || "").trim().slice(0, 900) || "No body";
}

function renderConflictPanel() {
  elements.conflictPanel.hidden = !state.conflicts.length;
  if (!state.conflicts.length) {
    elements.conflictList.innerHTML = "";
    return;
  }

  elements.conflictList.innerHTML = state.conflicts.map((conflict) => {
    const local = conflict.clientChange?.data || {};
    const server = conflict.serverNote || {};
    return `
      <article class="conflict-item" data-conflict-id="${escapeHtml(conflict.clientId)}">
        <header>
          <div>
            <span class="tag warm">Conflict</span>
            <h3>${escapeHtml(server.title || local.title || "Untitled note")}</h3>
          </div>
          <span>Server v${escapeHtml(server.syncVersion || "unknown")}</span>
        </header>
        <div class="conflict-compare">
          <div>
            <strong>Server</strong>
            <p>${escapeHtml(server.title || "Untitled note")}</p>
            <pre>${escapeHtml(conflictPreview(server.body))}</pre>
          </div>
          <div>
            <strong>Local edit</strong>
            <p>${escapeHtml(local.title || "Untitled note")}</p>
            <pre>${escapeHtml(conflictPreview(local.body))}</pre>
          </div>
        </div>
        <div class="conflict-actions">
          <button type="button" data-conflict-action="server" data-conflict-id="${escapeHtml(conflict.clientId)}">Keep server</button>
          <button type="button" data-conflict-action="local" data-conflict-id="${escapeHtml(conflict.clientId)}">Use local</button>
          <button type="button" data-conflict-action="merge" data-conflict-id="${escapeHtml(conflict.clientId)}">Edit local</button>
        </div>
      </article>
    `;
  }).join("");
}

function restoreDraftCache() {
  const draft = readCache(cacheKeys.draft, null);
  if (!draft) return false;

  state.localDraftRestored = true;
  state.selectedId = draft.selectedId || null;
  elements.notebook.value = draft.notebookId || "";
  elements.tags.value = (draft.tags || []).join(", ");
  elements.title.value = draft.title || "Untitled note";
  const html = draft.bodyFormat === "html" ? draft.body : markdownToHtml(draft.body);
  setEditorHtml(html);
  renderTasks();
  setStatus(`Restored local draft from ${formatDate(draft.cachedAt)}`);
  setCacheStatus("Draft restored", "Review and sync when ready");
  return true;
}

function selectNote(note) {
  state.selectedId = note?.id || null;
  if (note) setMobilePanel("editor");
  elements.notebook.value = note?.notebookId || "";
  elements.tags.value = (note?.tags || []).join(", ");
  elements.title.value = note?.title || "Untitled note";
  const bodyHtml = note?.bodyFormat === "markdown"
    ? markdownToHtml(note.body)
    : (note?.body || "");
  setEditorHtml(bodyHtml);
  setStatus(note?.updatedAt ? `Updated ${formatDate(note.updatedAt)}` : "Not saved yet");

  // Update editor breadcrumb with notebook or current view
  if (elements.editorBreadcrumb) {
    const notebook = note?.notebookId
      ? state.notebooks.find((nb) => nb.id === note.notebookId)
      : null;
    elements.editorBreadcrumb.textContent = notebook?.name || viewLabel();
  }

  renderTasks();
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
    home: "Home",
    all: "All notes",
    favorites: "Favorites",
    tasks: "Tasks",
    archive: "Archive"
  }[state.filter] || "All notes";
}

function currentSearchState() {
  return {
    search: elements.search.value.trim(),
    filter: state.filter,
    notebookFilter: state.notebookFilter,
    tagFilter: state.tagFilter
  };
}

function hasSearchCriteria(savedSearch = currentSearchState()) {
  return Boolean(
    savedSearch.search
    || savedSearch.notebookFilter
    || savedSearch.tagFilter
    || !["all", ""].includes(savedSearch.filter)
  );
}

function defaultSavedSearchName(savedSearch = currentSearchState()) {
  if (elements.savedSearchName.value.trim()) return elements.savedSearchName.value.trim();
  if (savedSearch.search) return savedSearch.search;
  return viewLabel();
}

function persistSavedSearches() {
  writeCache(cacheKeys.savedSearches, state.savedSearches);
}

function renderSavedSearches() {
  if (!state.savedSearches.length) {
    elements.savedSearchesList.innerHTML = '<span>No saved searches yet</span>';
    return;
  }

  elements.savedSearchesList.innerHTML = state.savedSearches.map((savedSearch) => `
    <article class="saved-search" data-saved-search-id="${escapeHtml(savedSearch.id)}">
      <button type="button" data-saved-search-apply="${escapeHtml(savedSearch.id)}">
        <strong>${escapeHtml(savedSearch.name)}</strong>
        <span>${escapeHtml(savedSearch.search || savedSearch.tagFilter || savedSearch.filter || "all notes")}</span>
      </button>
      <button type="button" aria-label="Delete saved search" title="Delete saved search" data-saved-search-delete="${escapeHtml(savedSearch.id)}">x</button>
    </article>
  `).join("");
}

function loadSavedSearches() {
  state.savedSearches = readCache(cacheKeys.savedSearches, []);
  renderSavedSearches();
}

function saveCurrentSearch(explicitName) {
  const savedSearch = currentSearchState();
  if (!hasSearchCriteria(savedSearch)) {
    setStatus("Add search text or choose a filter before saving");
    return false;
  }

  // Use explicit name if provided (from the name input field), then fall back
  const name = (explicitName || "").trim() || defaultSavedSearchName(savedSearch);
  state.savedSearches = [
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      createdAt: new Date().toISOString(),
      ...savedSearch
    },
    ...state.savedSearches.filter((item) => item.name.toLowerCase() !== name.toLowerCase())
  ].slice(0, 12);
  elements.savedSearchName.value = "";
  if (elements.savedSearchNameRow) elements.savedSearchNameRow.hidden = true;
  persistSavedSearches();
  renderSavedSearches();
  setStatus(`Saved search "${name}"`);
  return true;
}

function applySavedSearch(savedSearch) {
  elements.search.value = savedSearch.search || "";
  state.filter = savedSearch.filter || "all";
  state.notebookFilter = savedSearch.notebookFilter || null;
  state.tagFilter = savedSearch.tagFilter || null;
  loadNotes();
  setStatus(`Loaded search "${savedSearch.name}"`);
}

function deleteSavedSearch(id) {
  const savedSearch = state.savedSearches.find((item) => item.id === id);
  state.savedSearches = state.savedSearches.filter((item) => item.id !== id);
  persistSavedSearches();
  renderSavedSearches();
  if (savedSearch) setStatus(`Deleted search "${savedSearch.name}"`);
}

function visibleNotes() {
  return state.notes.filter((note) => {
    if (state.notebookFilter && note.notebookId !== state.notebookFilter) return false;
    if (state.tagFilter && !note.tags?.includes(state.tagFilter)) return false;
    if (state.filter === "archive") return Boolean(note.archivedAt);
    if (note.archivedAt) return false;
    if (state.filter === "favorites") return note.favorite;
    if (state.filter === "tasks") return parseChecklistTasks(note.body).length > 0 || /<input[^>]+type="checkbox"/i.test(note.body);
    return true;
  });
}

function filteredNotes() {
  return visibleNotes().filter(noteMatchesSearch);
}

function applyContextPanelState() {
  elements.appShell?.classList.toggle("context-collapsed", state.contextCollapsed);
  if (elements.toggleContext) {
    elements.toggleContext.setAttribute("aria-pressed", state.contextCollapsed ? "false" : "true");
    elements.toggleContext.setAttribute("aria-label", state.contextCollapsed ? "Show note tools" : "Hide note tools");
    elements.toggleContext.title = state.contextCollapsed ? "Show note tools" : "Hide note tools";
  }
}

function toggleContextPanel() {
  state.contextCollapsed = !state.contextCollapsed;
  localStorage.setItem(cacheKeys.contextCollapsed, String(state.contextCollapsed));
  applyContextPanelState();
}

function noteMatchesSearch(note) {
  const term = elements.search.value.trim().toLowerCase();
  if (!term) return true;
  return [
    note.title,
    note.body,
    note.notebookName,
    ...(note.tags || [])
  ].some((value) => String(value || "").toLowerCase().includes(term));
}

function updateNavigationState() {
  const isHome = state.filter === "home";

  // Show/hide home view vs note list + editor + context panel
  elements.homeView.hidden = !isHome;
  elements.noteListPanel.hidden = isHome;
  if (elements.editorPanel) elements.editorPanel.hidden = isHome;
  if (elements.contextPanel) elements.contextPanel.hidden = isHome;
  applyContextPanelState();

  elements.listTitle.textContent = viewLabel();
  elements.listEyebrow.textContent = state.notebookFilter ? "Notebook" : state.tagFilter ? "Tag" : "Notes";

  // Update breadcrumb
  if (elements.editorBreadcrumb) {
    elements.editorBreadcrumb.textContent = viewLabel();
  }

  elements.mainNav.querySelectorAll("[data-view-filter]").forEach((link) => {
    link.classList.toggle("active", !state.notebookFilter && !state.tagFilter && link.dataset.viewFilter === state.filter);
  });

  elements.notebooksList.querySelectorAll("[data-notebook-filter]").forEach((link) => {
    link.classList.toggle("active", Number(link.dataset.notebookFilter) === state.notebookFilter);
  });

  elements.tagsNav.querySelectorAll("[data-tag-filter]").forEach((link) => {
    link.classList.toggle("active", link.dataset.tagFilter === state.tagFilter);
  });

  setMobilePanel(isHome ? "home" : state.mobilePanel === "home" ? "list" : state.mobilePanel);
}

function setMobilePanel(panel) {
  const allowedPanels = new Set(["home", "list", "editor", "tools"]);
  state.mobilePanel = allowedPanels.has(panel) ? panel : "list";
  document.body.dataset.mobilePanel = state.mobilePanel;
  elements.mobileTabs?.querySelectorAll("[data-mobile-panel]").forEach((button) => {
    const active = button.dataset.mobilePanel === state.mobilePanel;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
}

function renderTasks() {
  const tasks = parseChecklistTasks(getEditorHtml());
  const complete = tasks.filter((task) => task.checked).length;
  elements.taskSummary.textContent = tasks.length
    ? `${complete} of ${tasks.length} complete`
    : "No checklist items";

  if (!tasks.length) {
    elements.taskList.innerHTML = '<div class="empty-state">Add checklist lines to track tasks in this note.</div>';
    return;
  }

  elements.taskList.innerHTML = tasks.map((task, index) => `
    <button class="task-item ${task.checked ? "complete" : ""}" type="button" data-task-index="${index}">
      <span aria-hidden="true">${task.checked ? "[x]" : "[ ]"}</span>
      <span>${escapeHtml(task.text)}</span>
    </button>
  `).join("");
}

// Save the selection so toolbar button clicks don't lose it.
let savedSelection = null;

function saveSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    savedSelection = sel.getRangeAt(0).cloneRange();
  }
}

function restoreSelection() {
  if (!savedSelection) return;
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(savedSelection);
  }
}

function updateFloatingToolbar() {
  const toolbar = elements.floatingToolbar;
  if (!toolbar) return;

  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
    toolbar.hidden = true;
    return;
  }

  // Only show when the selection is inside the editor
  const range = sel.getRangeAt(0);
  if (!elements.body.contains(range.commonAncestorContainer)) {
    toolbar.hidden = true;
    return;
  }

  const rect = range.getBoundingClientRect();
  if (!rect || rect.width === 0) {
    toolbar.hidden = true;
    return;
  }

  // Position the toolbar centered above the selection
  toolbar.hidden = false;
  const toolbarWidth = toolbar.offsetWidth || 320;
  const gap = 8;
  let left = rect.left + rect.width / 2 - toolbarWidth / 2;
  let top = rect.top - toolbar.offsetHeight - gap;

  // Clamp within viewport
  left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8));
  if (top < 8) {
    top = rect.bottom + gap;
  }

  toolbar.style.left = `${Math.round(left)}px`;
  toolbar.style.top = `${Math.round(top)}px`;
}

function editorExec(command, value = null) {
  elements.body.focus();
  restoreSelection();
  document.execCommand(command, false, value);
  saveDraftCache();
  renderTasks();
}

function insertChecklistItem() {
  elements.body.focus();
  restoreSelection();

  // Insert a new list item with a checkbox using execCommand insertHTML.
  const html = '<ul class="checklist"><li class="task-item"><input type="checkbox" data-task-check> </li></ul>';
  document.execCommand("insertHTML", false, html);
  saveDraftCache();
  renderTasks();
}

function toggleTaskAtIndex(taskIndex) {
  const tasks = parseChecklistTasks(getEditorHtml());
  const task = tasks[taskIndex];
  if (!task || !task.li) return;

  // Find the matching li in the live DOM
  const allLis = elements.body.querySelectorAll("li.task-item, li.complete");
  const liveLi = allLis[taskIndex];
  if (!liveLi) return;

  const checkbox = liveLi.querySelector("input[type='checkbox']");
  const isChecked = checkbox ? checkbox.checked : liveLi.classList.contains("complete");
  if (checkbox) {
    checkbox.checked = !isChecked;
  }
  liveLi.classList.toggle("complete", !isChecked);
  liveLi.classList.toggle("task-item", isChecked);

  // Dispatch a synthetic input event so the editor's input handler
  // updates the status bar and draft cache, signalling unsaved changes.
  elements.body.dispatchEvent(new Event("input", { bubbles: true }));
}

function selectionIsInEditor(range) {
  if (!range || !elements.body) return false;
  const container = range.commonAncestorContainer;
  return elements.body === container || elements.body.contains(container);
}

function applyInlineStyle(styles) {
  elements.body.focus();
  restoreSelection();

  const sel = window.getSelection();
  if (!sel?.rangeCount) return false;

  const range = sel.getRangeAt(0);
  if (!selectionIsInEditor(range) || range.collapsed) return false;

  const span = document.createElement("span");
  Object.entries(styles).forEach(([property, value]) => {
    span.style[property] = value;
  });
  span.appendChild(range.extractContents());
  range.insertNode(span);

  const nextRange = document.createRange();
  nextRange.selectNodeContents(span);
  sel.removeAllRanges();
  sel.addRange(nextRange);
  saveSelection();
  saveDraftCache();
  renderTasks();
  return true;
}

function applyToolbarSelect(kind, value) {
  elements.body.focus();
  restoreSelection();

  if (kind === "block") {
    document.execCommand("formatBlock", false, value || "p");
    saveDraftCache();
    renderTasks();
    return;
  }

  if (kind === "font" && toolbarFonts[value]) {
    applyInlineStyle({ fontFamily: toolbarFonts[value] });
    return;
  }

  if (kind === "size" && sanitizeCssFontSize(value)) {
    applyInlineStyle({ fontSize: value });
  }
}

function applyToolbarColor(property, value) {
  const color = sanitizeCssColor(value);
  if (!color || !["color", "backgroundColor"].includes(property)) return;
  applyInlineStyle({ [property]: color });
}

function anchorBlock() {
  const sel = window.getSelection();
  if (!sel?.anchorNode) return null;
  return sel.anchorNode.nodeType === Node.ELEMENT_NODE
    ? sel.anchorNode
    : sel.anchorNode.parentElement;
}

function applyWysiwygFormat(format) {
  elements.body.focus();
  restoreSelection();

  if (format === "bold") {
    // execCommand("bold") produces <b>, which our sanitizer strips.
    // Instead wrap the selection in <strong>, or unwrap if already bold.
    const sel = window.getSelection();
    const alreadyBold = sel?.anchorNode?.parentElement?.closest("strong") ||
      document.queryCommandState("bold");
    if (alreadyBold) {
      document.execCommand("removeFormat", false, null);
    } else if (sel && !sel.isCollapsed) {
      document.execCommand("insertHTML", false,
        `<strong>${escapeHtml(sel.toString())}</strong>`);
    }
  }
  else if (format === "italic") {
    // Same issue: execCommand produces <i>, sanitizer only allows <em>.
    const sel = window.getSelection();
    const alreadyItalic = sel?.anchorNode?.parentElement?.closest("em") ||
      document.queryCommandState("italic");
    if (alreadyItalic) {
      document.execCommand("removeFormat", false, null);
    } else if (sel && !sel.isCollapsed) {
      document.execCommand("insertHTML", false,
        `<em>${escapeHtml(sel.toString())}</em>`);
    }
  }
  else if (format === "underline") { document.execCommand("underline", false, null); }
  else if (format === "heading") {
    // Toggle between h2 and normal paragraph
    const block = anchorBlock()?.closest("h2, h3, h4, p, div");
    if (block && /^H[2-4]$/.test(block.tagName)) {
      document.execCommand("formatBlock", false, "p");
    } else {
      document.execCommand("formatBlock", false, "h2");
    }
  }
  else if (format === "bullet") { document.execCommand("insertUnorderedList", false, null); }
  else if (format === "ordered") { document.execCommand("insertOrderedList", false, null); }
  else if (format === "quote") {
    // Toggle blockquote on/off
    const block = anchorBlock()?.closest("blockquote, p, div, h2, h3, h4");
    if (block?.tagName === "BLOCKQUOTE") {
      document.execCommand("formatBlock", false, "p");
    } else {
      document.execCommand("formatBlock", false, "blockquote");
    }
  }
  else if (format === "code") {
    const sel = window.getSelection();
    const selected = sel?.toString() || "";
    if (selected) {
      document.execCommand("insertHTML", false, `<code>${escapeHtml(selected)}</code>`);
    } else {
      document.execCommand("insertHTML", false, "<code>code</code>");
    }
  }
  else if (format === "link") {
    const sel = window.getSelection();
    const selected = sel?.toString() || "";
    const url = window.prompt("URL:", "https://");
    if (url && isSafeUrl(url)) {
      if (selected) {
        document.execCommand("createLink", false, url);
      } else {
        document.execCommand("insertHTML", false, `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
      }
    }
  }
  else if (format === "strikethrough") { document.execCommand("strikeThrough", false, null); }
  else if (format === "superscript") { document.execCommand("superscript", false, null); }
  else if (format === "subscript") { document.execCommand("subscript", false, null); }
  else if (format === "align-left") { document.execCommand("justifyLeft", false, null); }
  else if (format === "align-center") { document.execCommand("justifyCenter", false, null); }
  else if (format === "align-right") { document.execCommand("justifyRight", false, null); }
  else if (format === "indent") { document.execCommand("indent", false, null); }
  else if (format === "outdent") { document.execCommand("outdent", false, null); }
  else if (format === "hr") {
    document.execCommand("insertHTML", false, "<hr><p></p>");
  }
  else if (format === "clear") {
    document.execCommand("removeFormat", false, null);
  }

  saveDraftCache();
  renderTasks();
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
        ${attachment.thumbnailUrl ? `<img src="${attachment.thumbnailUrl}" alt="" loading="lazy">` : '<span class="attachment-icon" aria-hidden="true">FILE</span>'}
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

// Holds the most recent AI payload so the apply button can act on it.
let lastAiPayload = null;

function renderAiOutput(payload) {
  lastAiPayload = payload;
  const output = payload.output || {};
  const action = payload.action?.replaceAll("-", " ") || "AI";
  let body = output.text || "";

  if (Array.isArray(output.summary)) {
    body = output.summary.map((item) => `- ${item}`).join("\n");
  } else if (Array.isArray(output.tasks)) {
    body = output.tasks.map((item) => `- [ ] ${item}`).join("\n");
  } else if (Array.isArray(output.tags)) {
    body = output.tags.map((item) => `#${item}`).join(" ");
  } else if (output.title) {
    body = output.title;
  } else if (output.answer) {
    body = output.answer;
  } else if (Array.isArray(output.related)) {
    body = output.related.length
      ? output.related.map((note) => {
        const tags = note.tags?.length ? ` #${note.tags.join(" #")}` : "";
        return `- ${note.title || "Untitled note"}${note.notebookName ? ` (${note.notebookName})` : ""}${tags}`;
      }).join("\n")
      : "No related notes found.";
  } else if (!body) {
    body = JSON.stringify(output, null, 2);
  }

  elements.aiResult.textContent = `${action}${payload.cached ? " (cached)" : ""}\n${body}`;

  // Show the apply button only for actions that can write back to the editor
  const applyBtn = document.querySelector("[data-ai-apply]");
  if (!applyBtn) return;
  if (payload.action === "clean-up" && output.text) {
    applyBtn.textContent = "Apply to note";
    applyBtn.hidden = false;
  } else if (payload.action === "extract-tasks" && Array.isArray(output.tasks) && output.tasks.length) {
    applyBtn.textContent = "Insert into note";
    applyBtn.hidden = false;
  } else {
    applyBtn.hidden = true;
  }
}

function applyAiResult() {
  if (!lastAiPayload) return;
  const output = lastAiPayload.output || {};
  const applyBtn = document.querySelector("[data-ai-apply]");

  if (lastAiPayload.action === "clean-up" && output.text) {
    // Replace editor content — convert double-newlines to paragraphs
    const html = output.text
      .split(/\n{2,}/)
      .map((para) => `<p>${escapeHtml(para.trim())}</p>`)
      .join("");
    setEditorHtml(html || `<p>${escapeHtml(output.text)}</p>`);
    saveDraftCache();
    renderTasks();
    setStatus("Clean-up applied — review and Sync when ready");
    elements.aiResult.textContent = "Clean-up applied to note.";
    if (applyBtn) applyBtn.hidden = true;
    lastAiPayload = null;
    return;
  }

  if (lastAiPayload.action === "extract-tasks" && Array.isArray(output.tasks)) {
    // Append tasks as a checklist at the end of the editor
    const checklistHtml = `<ul class="checklist">${
      output.tasks.map((task) => (
        `<li class="task-item"><input type="checkbox" data-task-check> ${escapeHtml(task)}</li>`
      )).join("")
    }</ul><p></p>`;
    elements.body.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(elements.body);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("insertHTML", false, checklistHtml);
    saveDraftCache();
    renderTasks();
    setStatus("Tasks inserted — review and Sync when ready");
    elements.aiResult.textContent = "Tasks inserted into note.";
    if (applyBtn) applyBtn.hidden = true;
    lastAiPayload = null;
  }
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

  elements.notebooksList.innerHTML = state.notebooks.length
    ? state.notebooks.map((notebook) => `
        <div class="notebook-row" data-notebook-id="${notebook.id}">
          <a href="#notebook-${notebook.id}" data-notebook-filter="${notebook.id}" class="notebook-row-link">
            <span class="notebook-row-name">${escapeHtml(notebook.name)}</span>
            <small>${notebook.noteCount || 0}</small>
          </a>
          <div class="notebook-row-actions">
            <button type="button" class="btn-notebook-rename" data-notebook-rename="${notebook.id}" aria-label="Rename notebook" title="Rename">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
            </button>
            <button type="button" class="btn-notebook-delete" data-notebook-delete="${notebook.id}" aria-label="Delete notebook" title="Delete">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
        </div>
      `).join("")
    : '<span class="sidebar-empty">No notebooks yet</span>';

  elements.tagsNav.innerHTML = state.tags.length
    ? state.tags.map((tag) => `
        <a href="#tag-${escapeHtml(tag.name)}" data-tag-filter="${escapeHtml(tag.name)}">
          <span>#${escapeHtml(tag.name)}</span>
          <small>${tag.noteCount || 0}</small>
        </a>
      `).join("")
    : '<span class="sidebar-empty">No tags yet</span>';

  elements.tagsList.innerHTML = state.tags.map((tag) => (
    `<option value="${escapeHtml(tag.name)}"></option>`
  )).join("");

  // Also refresh home view notebooks grid if present
  renderHomeNotebooks();
  updateNavigationState();
}

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function renderHomeNotebooks() {
  if (!elements.homeNotebooks) return;
  if (!state.notebooks.length) {
    elements.homeNotebooks.innerHTML = '<p class="home-empty">No notebooks yet. Create one from the sidebar.</p>';
    return;
  }
  elements.homeNotebooks.innerHTML = state.notebooks.map((notebook) => `
    <button class="home-notebook-card" type="button" data-notebook-filter="${notebook.id}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
      <strong>${escapeHtml(notebook.name)}</strong>
      <span>${notebook.noteCount || 0} note${notebook.noteCount === 1 ? "" : "s"}</span>
    </button>
  `).join("");
}

function renderHomeView() {
  if (!elements.homeView || elements.homeView.hidden) return;

  // Update greeting
  if (elements.homeGreeting) {
    elements.homeGreeting.textContent = timeGreeting();
  }

  // Render recent notes — show up to 8 most recent non-archived notes
  if (elements.homeRecent) {
    const recent = state.notes
      .filter((note) => !note.archivedAt)
      .slice(0, 8);

    if (!recent.length) {
      elements.homeRecent.innerHTML = '<p class="home-empty">No notes yet. Hit "New note" to get started.</p>';
    } else {
      elements.homeRecent.innerHTML = recent.map((note) => `
        <button class="home-card" type="button" data-note-id="${note.id}">
          <span class="home-card-notebook">${escapeHtml(note.notebookName || "Note")}</span>
          <h3 class="home-card-title">${escapeHtml(note.title || "Untitled note")}</h3>
          <p class="home-card-snippet">${escapeHtml(stripHtml(note.body).slice(0, 120) || "")}</p>
          <time class="home-card-date">${escapeHtml(formatDate(note.updatedAt))}</time>
        </button>
      `).join("");
    }
  }

  renderHomeNotebooks();
}

function renderNotes() {
  const notes = filteredNotes();
  const search = elements.search.value.trim();
  updateNavigationState();
  elements.searchSummary.textContent = search
    ? `${notes.length} result${notes.length === 1 ? "" : "s"} for "${search}"`
    : `${notes.length} note${notes.length === 1 ? "" : "s"} in ${viewLabel()}`;

  if (!notes.length) {
    elements.list.innerHTML = `
      <article class="note-card">
        <span class="note-card-notebook">Empty</span>
        <h3 class="note-card-title">No matching notes</h3>
        <p class="note-card-snippet">${search ? "Try a different search or clear the search field." : "Create a note or switch views to see more."}</p>
        <time class="note-card-date">${escapeHtml(viewLabel())}</time>
      </article>
    `;
    return;
  }

  elements.list.innerHTML = notes.map((note) => `
    <article class="note-card ${note.id === state.selectedId ? "active" : ""}" data-note-id="${note.id}" tabindex="0">
      <span class="note-card-notebook">${escapeHtml(note.notebookName || (note.tags?.[0] ? `#${note.tags[0]}` : "Note"))}</span>
      <h3 class="note-card-title">${escapeHtml(note.title || "Untitled note")}${note.favorite ? ' <span class="note-card-star" aria-label="Favorite">★</span>' : ""}</h3>
      <p class="note-card-snippet">${escapeHtml(searchSnippet(note))}</p>
      <time class="note-card-date" datetime="${escapeHtml(note.updatedAt || "")}">${escapeHtml(formatDate(note.updatedAt))}</time>
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
      body: getEditorHtml(),
      bodyFormat: "html",
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

async function deleteNotebook(notebookId) {
  const notebook = state.notebooks.find((nb) => nb.id === notebookId);
  if (!notebook) return;
  if (!window.confirm(`Delete notebook "${notebook.name}"? Notes in it will be moved to "No notebook".`)) return;

  try {
    const payload = await requestJson(`/api/notebooks/${notebookId}`, {
      method: "DELETE"
    });
    state.notebooks = payload.notebooks || [];
    // If we were filtering by this notebook, reset to all notes
    if (state.notebookFilter === notebookId) {
      state.notebookFilter = null;
      state.filter = "all";
    }
    writeCache(cacheKeys.collections, {
      notebooks: state.notebooks,
      tags: state.tags,
      cachedAt: new Date().toISOString()
    });
    renderCollections();
    loadNotes();
    setStatus(`Deleted notebook "${notebook.name}"`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function renameNotebook(notebookId) {
  const notebook = state.notebooks.find((nb) => nb.id === notebookId);
  if (!notebook) return;
  const name = window.prompt("Rename notebook:", notebook.name);
  if (!name || name.trim() === notebook.name) return;

  try {
    const payload = await requestJson(`/api/notebooks/${notebookId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: name.trim() })
    });
    state.notebooks = payload.notebooks || [];
    writeCache(cacheKeys.collections, {
      notebooks: state.notebooks,
      tags: state.tags,
      cachedAt: new Date().toISOString()
    });
    renderCollections();
    renderNotes();
    setStatus(`Renamed to "${name.trim()}"`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function loadNotes() {
  const params = new URLSearchParams();
  const search = elements.search.value.trim();
  if (search) params.set("q", search);
  if (state.notebookFilter) params.set("notebookId", state.notebookFilter);
  if (state.tagFilter) params.set("tag", state.tagFilter);
  if (state.filter === "favorites") params.set("favorite", "1");
  if (state.filter === "tasks") params.set("tasks", "1");
  if (state.filter === "archive") {
    params.set("archived", "only");
  } else {
    params.set("archived", "active");
  }

  try {
    const payload = await requestJson(`/api/notes${params.size ? `?${params}` : ""}`);
    state.notes = payload.notes || [];
    writeCache(cacheKeys.notes, {
      notes: state.notes,
      cachedAt: new Date().toISOString()
    });
    renderNotes();
    renderHomeView();
    if (state.filter !== "home" && state.notes.length && !state.selectedId && !state.localDraftRestored) {
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
      state.conflicts = conflicts.map((conflict) => ({
        ...conflict,
        clientChange: changes.find((change) => change.clientId === conflict.clientId) || null
      }));
      renderConflictPanel();
      setStatus(`${conflicts.length} sync conflict${conflicts.length === 1 ? "" : "s"} need review`);
      elements.aiResult.textContent = "Review the sync conflict panel above the editor.";
      return;
    }

    state.conflicts = [];
    renderConflictPanel();
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

async function resolveConflict(clientId, action) {
  const conflict = state.conflicts.find((item) => item.clientId === clientId);
  if (!conflict) return;

  const local = conflict.clientChange?.data || {};
  const server = conflict.serverNote;

  if (action === "server") {
    removePendingChange(clientId);
    state.conflicts = state.conflicts.filter((item) => item.clientId !== clientId);
    const index = state.notes.findIndex((note) => note.id === server.id);
    if (index >= 0) state.notes[index] = server;
    selectNote(server);
    renderConflictPanel();
    setStatus("Kept server version");
    return;
  }

  if (action === "merge") {
    removePendingChange(clientId);
    state.conflicts = state.conflicts.filter((item) => item.clientId !== clientId);
    selectNote({
      ...server,
      notebookId: local.notebookId ?? server.notebookId,
      title: local.title ?? server.title,
      body: local.body ?? server.body,
      bodyFormat: local.bodyFormat || server.bodyFormat,
      tags: local.tags || server.tags
    });
    saveDraftCache();
    renderConflictPanel();
    setStatus("Local edit loaded. Review and Sync when ready.");
    return;
  }

  if (action === "local") {
    try {
      const payload = await requestJson(`/api/notes/${server.id}`, {
        method: "PUT",
        body: JSON.stringify(local)
      });
      removePendingChange(clientId);
      state.conflicts = state.conflicts.filter((item) => item.clientId !== clientId);
      const updated = payload.note;
      const index = state.notes.findIndex((note) => note.id === updated.id);
      if (index >= 0) state.notes[index] = updated;
      selectNote(updated);
      renderConflictPanel();
      setStatus("Applied local edit");
    } catch (error) {
      setStatus(error.message);
    }
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
  const thumbnail = await createAttachmentThumbnail(file);
  if (thumbnail) {
    form.append("thumbnail", thumbnail, "thumbnail.webp");
  }
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

function pickReplacementFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.style.display = "none";
    document.body.appendChild(input);

    input.addEventListener("change", () => {
      const file = input.files?.[0] || null;
      document.body.removeChild(input);
      resolve(file);
    }, { once: true });

    // If the user cancels without picking, the change event never fires.
    // Detect cancel via a window focus event that fires after the picker closes.
    const onFocus = () => {
      window.removeEventListener("focus", onFocus);
      // Give the change event a chance to fire first
      setTimeout(() => {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
          resolve(null);
        }
      }, 300);
    };
    window.addEventListener("focus", onFocus);

    input.click();
  });
}

async function replaceSelectedAttachment(attachmentId) {
  setStatus("Choose a replacement file…");
  const file = await pickReplacementFile();

  if (!file) {
    setStatus("Replace cancelled");
    return;
  }
  if (file.size > state.attachmentLimitMb * 1024 * 1024) {
    setStatus(`Attachment exceeds ${state.attachmentLimitMb} MB`);
    return;
  }

  const form = new FormData();
  form.append("file", file);
  const thumbnail = await createAttachmentThumbnail(file);
  if (thumbnail) {
    form.append("thumbnail", thumbnail, "thumbnail.webp");
  }
  setStatus("Replacing attachment…");

  // Update the Replace button text to give feedback while uploading
  const replaceBtn = elements.attachmentList.querySelector(
    `[data-attachment-replace="${attachmentId}"]`
  );
  if (replaceBtn) replaceBtn.textContent = "Replacing…";

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
    renderAttachments();
    setStatus(`Replaced ${payload.attachment.filename}`);
  } catch (error) {
    setStatus(error.message);
    if (replaceBtn) replaceBtn.textContent = "Replace";
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

function formatExportStatus(payload) {
  const counts = payload.counts || {};
  const missing = (payload.missingAttachments?.length || 0) + (payload.missingThumbnails?.length || 0);
  const parts = [
    `${counts.notes || 0} notes`,
    `${counts.attachments || 0} files`,
    `${formatBytes(counts.attachmentBytes || 0)} attachments`
  ];
  return `${payload.ok ? "Backup check passed" : "Backup needs attention"}: ${parts.join(", ")}${missing ? `, ${missing} missing` : ""}`;
}

async function checkExportStatus() {
  elements.exportStatus.textContent = "Checking backup...";
  try {
    const payload = await requestJson("/api/export/status");
    elements.exportStatus.textContent = formatExportStatus(payload);
    setStatus(payload.ok ? "Backup check passed" : "Backup check found missing files");
  } catch (error) {
    elements.exportStatus.textContent = error.message;
    setStatus("Backup check failed");
  }
}

function renderStoredBackups(backups = []) {
  if (!elements.backupList) return;
  if (!backups.length) {
    elements.backupList.innerHTML = '<div class="empty-state">No saved backups yet.</div>';
    return;
  }

  elements.backupList.innerHTML = backups.slice(0, 5).map((backup) => `
    <a class="backup-item"
       href="${escapeHtml(backup.downloadUrl)}"
       download="${escapeHtml(backup.filename)}"
       title="Download ${escapeHtml(backup.filename)}">
      <span class="backup-item-name">
        <svg viewBox="0 0 24 24" aria-hidden="true" class="backup-item-icon"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        ${escapeHtml(formatDate(backup.createdAt))}
      </span>
      <small>${escapeHtml(formatBytes(backup.sizeBytes || 0))}</small>
    </a>
  `).join("");
}

async function listStoredBackups() {
  if (!elements.backupList) return;
  elements.backupList.innerHTML = '<div class="empty-state">Loading backups...</div>';
  try {
    const payload = await requestJson("/api/backups");
    renderStoredBackups(payload.backups || []);
    setStatus("Backup list refreshed");
  } catch (error) {
    elements.backupList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    setStatus("Could not list backups");
  }
}

async function createStoredBackup() {
  elements.exportStatus.textContent = "Creating saved backup...";
  try {
    const payload = await requestJson("/api/backups", {
      method: "POST",
      body: JSON.stringify({})
    });
    elements.exportStatus.textContent = `Saved backup: ${formatBytes(payload.backup?.sizeBytes || 0)}`;
    await listStoredBackups();
    setStatus("Saved backup created");
  } catch (error) {
    elements.exportStatus.textContent = error.message;
    setStatus("Saved backup failed");
  }
}

function createNewNote() {
  state.localDraftRestored = true;
  state.selectedId = null;
  if (state.filter === "home") {
    state.filter = "all";
    updateNavigationState();
  }
  setMobilePanel("editor");
  elements.notebook.value = state.notebookFilter || state.notebooks[0]?.id || "";
  elements.tags.value = "";
  elements.title.value = "Untitled note";
  setEditorHtml("");
  setStatus("New draft");
  renderTasks();
  renderEditorActions(null);
  renderNotes();
  elements.title.focus();
}

function focusSelectedNoteCard() {
  const card = elements.list.querySelector(`[data-note-id="${state.selectedId}"]`);
  card?.focus();
}

function selectRelativeNote(direction) {
  const notes = filteredNotes();
  if (!notes.length) return;
  const currentIndex = Math.max(0, notes.findIndex((note) => note.id === state.selectedId));
  const nextIndex = Math.min(Math.max(currentIndex + direction, 0), notes.length - 1);
  selectNote(notes[nextIndex]);
  focusSelectedNoteCard();
}

function modifierPressed(event) {
  return event.metaKey || event.ctrlKey;
}

function handleGlobalShortcuts(event) {
  if (elements.appShell.hidden || event.altKey) return;
  const key = event.key.toLowerCase();

  if (modifierPressed(event) && key === "s") {
    event.preventDefault();
    saveNote();
    return;
  }

  if (modifierPressed(event) && key === "k") {
    event.preventDefault();
    elements.search.focus();
    elements.search.select();
    return;
  }

  if (modifierPressed(event) && key === "n") {
    event.preventDefault();
    createNewNote();
    return;
  }

  if (modifierPressed(event) && key === "enter") {
    event.preventDefault();
    insertChecklistItem();
    return;
  }

  if (modifierPressed(event) && shortcutFormats[key]) {
    // Let the browser handle bold/italic/underline natively in the editor
    // when the editor is focused; only intercept when editor is NOT focused.
    if (document.activeElement === elements.body) return;
    event.preventDefault();
    applyWysiwygFormat(shortcutFormats[key]);
    return;
  }

  if (modifierPressed(event) && event.key === "ArrowDown") {
    event.preventDefault();
    selectRelativeNote(1);
    return;
  }

  if (modifierPressed(event) && event.key === "ArrowUp") {
    event.preventDefault();
    selectRelativeNote(-1);
  }
}

async function runAiAction(action) {
  const question = elements.aiQuestion?.value.trim() || "";
  if (action === "ask-note" && !question) {
    elements.aiResult.textContent = "Ask a question first.";
    elements.aiQuestion?.focus();
    return;
  }

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
      body: JSON.stringify({ question })
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

  document.querySelectorAll("[data-action='new-note']").forEach((btn) => {
    btn.addEventListener("click", () => {
      // If we're on the home view, switch to note view first
      if (state.filter === "home") {
        state.filter = "all";
        updateNavigationState();
      }
      createNewNote();
    });
  });

  elements.mobileTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mobile-panel]");
    if (!button) return;
    const panel = button.dataset.mobilePanel;

    if (panel === "home") {
      state.filter = "home";
      state.notebookFilter = null;
      state.tagFilter = null;
      updateNavigationState();
      renderHomeView();
      loadNotes().catch(() => {});
      return;
    }

    if (state.filter === "home") {
      state.filter = "all";
      state.notebookFilter = null;
      state.tagFilter = null;
      updateNavigationState();
      loadNotes();
    }

    if (panel === "editor" && !state.selectedId && !state.localDraftRestored) {
      createNewNote();
      return;
    }

    setMobilePanel(panel);
  });

  elements.insertChecklist.addEventListener("click", insertChecklistItem);
  elements.formatButtons.forEach((button) => {
    // mousedown fires before the editor loses focus, so we save the selection first
    button.addEventListener("mousedown", (event) => {
      event.preventDefault(); // prevent editor losing focus
      saveSelection();
    });
    button.addEventListener("click", () => {
      applyWysiwygFormat(button.dataset.format);
      // Keep toolbar visible after applying format if still a selection
      updateFloatingToolbar();
    });
  });
  elements.formatSelects.forEach((select) => {
    select.addEventListener("mousedown", saveSelection);
    select.addEventListener("change", () => {
      applyToolbarSelect(select.dataset.formatSelect, select.value);
      updateFloatingToolbar();
    });
  });
  elements.formatColorInputs.forEach((input) => {
    input.closest(".toolbar-color")?.style.setProperty("--toolbar-swatch", input.value);
    input.addEventListener("mousedown", saveSelection);
    // Use both "input" (live, fires on every color change) and "change" (fires on close)
    // so the swatch updates immediately and the format is applied on picker close.
    input.addEventListener("input", () => {
      input.closest(".toolbar-color")?.style.setProperty("--toolbar-swatch", input.value);
    });
    input.addEventListener("change", () => {
      input.closest(".toolbar-color")?.style.setProperty("--toolbar-swatch", input.value);
      applyToolbarColor(input.dataset.formatColor, input.value);
      updateFloatingToolbar();
    });
  });
  elements.toggleFavorite.addEventListener("click", toggleFavoriteNote);
  elements.archiveNote.addEventListener("click", archiveCurrentNote);
  elements.deleteNote.addEventListener("click", deleteCurrentNote);
  elements.toggleContext?.addEventListener("click", toggleContextPanel);
  elements.saveNote.addEventListener("click", saveNote);
  elements.uploadAttachment.addEventListener("click", uploadAttachment);
  elements.aiActions.forEach((button) => {
    button.addEventListener("click", () => runAiAction(button.dataset.aiAction));
  });

  document.querySelector("[data-ai-apply]")?.addEventListener("click", applyAiResult);

  function triggerExportDownload(button, url, label) {
    const original = button.textContent;
    button.textContent = "Preparing…";
    button.disabled = true;
    setStatus(`Preparing ${label} download…`);
    // Use a hidden link so we get download semantics without navigating away
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      button.textContent = original;
      button.disabled = false;
      setStatus(`${label} download started`);
    }, 1200);
  }

  elements.exportJson.addEventListener("click", () => {
    triggerExportDownload(elements.exportJson, "/api/export.json", "JSON");
  });

  elements.exportMarkdown.addEventListener("click", () => {
    triggerExportDownload(elements.exportMarkdown, "/api/export.md", "Markdown");
  });

  elements.exportArchive.addEventListener("click", () => {
    triggerExportDownload(elements.exportArchive, "/api/export.tgz", "Archive");
  });

  elements.exportVerify.addEventListener("click", checkExportStatus);
  elements.exportCreateBackup.addEventListener("click", createStoredBackup);
  elements.exportListBackups.addEventListener("click", listStoredBackups);

  elements.passwordForm.addEventListener("submit", changePassword);

  elements.title.addEventListener("input", saveDraftCache);
  elements.body.addEventListener("input", () => {
    saveDraftCache();
    renderTasks();
  });
  // Track selection so toolbar knows where to insert formatting.
  elements.body.addEventListener("keyup", saveSelection);
  elements.body.addEventListener("mouseup", saveSelection);
  elements.body.addEventListener("selectionchange", saveSelection);
  // Handle checkbox clicks inside the editor directly.
  elements.body.addEventListener("click", (event) => {
    if (event.target.matches("input[data-task-check]")) {
      saveDraftCache();
      renderTasks();
    }
  });

  // Floating toolbar — show/hide on selection changes inside the editor.
  document.addEventListener("selectionchange", () => {
    updateFloatingToolbar();
  });

  // Hide floating toolbar when clicking outside editor and toolbar
  document.addEventListener("mousedown", (event) => {
    const toolbar = elements.floatingToolbar;
    if (!toolbar || toolbar.hidden) return;
    if (toolbar.contains(event.target) || elements.body.contains(event.target)) return;
    toolbar.hidden = true;
  });
  elements.notebook.addEventListener("change", saveDraftCache);
  elements.tags.addEventListener("input", saveDraftCache);

  elements.search.addEventListener("input", () => {
    window.clearTimeout(elements.search.searchTimer);
    elements.search.searchTimer = window.setTimeout(loadNotes, 250);
  });

  elements.clearSearch.addEventListener("click", () => {
    elements.search.value = "";
    loadNotes();
  });

  elements.saveSearch.addEventListener("click", () => {
    if (!hasSearchCriteria()) {
      setStatus("Add search text or choose a filter before saving");
      return;
    }
    // Show the name row for two-step save
    if (elements.savedSearchNameRow) {
      elements.savedSearchNameRow.hidden = false;
      elements.savedSearchName.value = defaultSavedSearchName();
      elements.savedSearchName.focus();
      elements.savedSearchName.select();
    } else {
      saveCurrentSearch();
    }
  });

  if (elements.confirmSaveSearch) {
    elements.confirmSaveSearch.addEventListener("click", () => {
      saveCurrentSearch(elements.savedSearchName?.value);
    });
  }

  if (elements.savedSearchName) {
    elements.savedSearchName.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveCurrentSearch(elements.savedSearchName.value);
      }
      if (event.key === "Escape") {
        elements.savedSearchName.value = "";
        if (elements.savedSearchNameRow) elements.savedSearchNameRow.hidden = true;
      }
    });
  }

  elements.savedSearchesList.addEventListener("click", (event) => {
    const apply = event.target.closest("[data-saved-search-apply]");
    const remove = event.target.closest("[data-saved-search-delete]");
    if (apply) {
      const savedSearch = state.savedSearches.find((item) => item.id === apply.dataset.savedSearchApply);
      if (savedSearch) applySavedSearch(savedSearch);
      return;
    }
    if (remove) {
      deleteSavedSearch(remove.dataset.savedSearchDelete);
    }
  });

  elements.conflictList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-conflict-action]");
    if (!button) return;
    resolveConflict(button.dataset.conflictId, button.dataset.conflictAction);
  });

  elements.mainNav.addEventListener("click", (event) => {
    const link = event.target.closest("[data-view-filter]");
    if (!link) return;
    event.preventDefault();
    state.filter = link.dataset.viewFilter;
    state.notebookFilter = null;
    state.tagFilter = null;
    if (state.filter === "home") {
      updateNavigationState();
      renderHomeView();
      // Refresh notes in the background so recent cards are never stale
      loadNotes().catch(() => {});
    } else {
      loadNotes();
    }
  });

  // Home view "See all" link
  if (elements.homeView) {
    elements.homeView.addEventListener("click", (event) => {
      const seeAll = event.target.closest("[data-view-filter]");
      if (seeAll) {
        event.preventDefault();
        state.filter = seeAll.dataset.viewFilter;
        state.notebookFilter = null;
        state.tagFilter = null;
        loadNotes();
        return;
      }
      // Home notebook card
      const nbCard = event.target.closest("[data-notebook-filter]");
      if (nbCard) {
        state.notebookFilter = Number(nbCard.dataset.notebookFilter);
        state.tagFilter = null;
        state.filter = "all";
        loadNotes();
        return;
      }
      // Home recent note card
      const noteCard = event.target.closest("[data-note-id]");
      if (noteCard) {
        const note = state.notes.find((item) => item.id === Number(noteCard.dataset.noteId));
        if (note) {
          state.filter = "all";
          state.notebookFilter = null;
          state.tagFilter = null;
          updateNavigationState();
          selectNote(note);
        }
      }
    });
  }

  // Focus search button in note list header
  if (elements.noteListFocusSearch) {
    elements.noteListFocusSearch.addEventListener("click", () => {
      elements.search.focus();
      elements.search.select();
    });
  }

  elements.notebooksList.addEventListener("click", (event) => {
    const deleteBtn = event.target.closest("[data-notebook-delete]");
    if (deleteBtn) {
      deleteNotebook(Number(deleteBtn.dataset.notebookDelete));
      return;
    }
    const renameBtn = event.target.closest("[data-notebook-rename]");
    if (renameBtn) {
      renameNotebook(Number(renameBtn.dataset.notebookRename));
      return;
    }
    const link = event.target.closest("[data-notebook-filter]");
    if (!link) return;
    event.preventDefault();
    state.notebookFilter = Number(link.dataset.notebookFilter);
    state.tagFilter = null;
    state.filter = "all";
    loadNotes();
  });

  elements.tagsNav.addEventListener("click", (event) => {
    const link = event.target.closest("[data-tag-filter]");
    if (!link) return;
    event.preventDefault();
    state.tagFilter = link.dataset.tagFilter;
    state.notebookFilter = null;
    state.filter = "all";
    loadNotes();
  });

  elements.list.addEventListener("click", (event) => {
    const card = event.target.closest("[data-note-id]");
    if (!card) return;
    const note = state.notes.find((item) => item.id === Number(card.dataset.noteId));
    if (note) selectNote(note);
  });

  elements.list.addEventListener("keydown", (event) => {
    const card = event.target.closest("[data-note-id]");
    if (!card) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const note = state.notes.find((item) => item.id === Number(card.dataset.noteId));
      if (note) selectNote(note);
    }
  });

  elements.taskList.addEventListener("click", (event) => {
    const task = event.target.closest("[data-task-index]");
    if (!task) return;
    toggleTaskAtIndex(Number(task.dataset.taskIndex));
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
  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsyncedWork()) return;
    event.preventDefault();
    event.returnValue = "";
  });
  window.addEventListener("keydown", handleGlobalShortcuts);
}

async function init() {
  bindEvents();
  hydrateConfig();
  if (!(await checkAuth())) return;

  // Set initial home greeting
  if (elements.homeGreeting) {
    elements.homeGreeting.textContent = timeGreeting();
  }

  loadSavedSearches();
  await loadCollections();
  const restoredDraft = restoreDraftCache();
  await loadNotes();
  schedulePendingSync();
  listStoredBackups().catch(() => {});

  // Render home view if it starts visible (home is default view)
  if (state.filter === "home") {
    renderHomeView();
  }

  if (restoredDraft) {
    setCacheStatus("Draft restored", "Sync when ready");
  }
}

init();
