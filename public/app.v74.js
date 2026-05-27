const cacheKeys = {
  draft: "edge_note_draft_v1",
  notes: "edge_note_notes_v1",
  collections: "edge_note_collections_v1",
  pendingChanges: "edge_note_pending_changes_v1",
  selectedId: "edge_note_selected_note_v1",
  savedSearches: "edge_note_saved_searches_v1"
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
  focusModeReturnState: null,
  autoSaveTimer: null,
  lastAutoSaveSignature: "",
  pendingSave: false,
  saveAgainRequested: false,
  editorRedoStack: [],
  editorUndoStack: [],
  suppressSelectionSave: false
};

let pendingSyncTimer = null;
const autoSaveDelayMs = 2500;

const elements = {
  attachmentFile: document.querySelector("[data-attachment-file]"),
  attachmentLimit: document.querySelector("[data-attachment-limit]"),
  attachmentList: document.querySelector("[data-attachments-list]"),
  inlineAttachments: document.querySelector("[data-inline-attachments]"),
  attachmentCount: document.querySelector("[data-attachment-count]"),
  appShell: document.querySelector("[data-app-shell]"),
  authForm: document.querySelector("[data-auth-form]"),
  authMessage: document.querySelector("[data-auth-message]"),
  authMode: document.querySelector("[data-auth-mode]"),
  authPanel: document.querySelector("[data-auth-panel]"),
  authPassword: document.querySelector("[data-auth-password]"),
  authSubmit: document.querySelector("[data-auth-submit]"),
  setupHelp: document.querySelector("[data-setup-help]"),
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
  notebookParent: document.querySelector("[data-notebook-parent]"),
  notebooksList: document.querySelector("[data-notebooks-list]"),
  nbManagePanel: document.querySelector("[data-nb-manage-panel]"),
  nbManageList: document.querySelector("[data-nb-manage-list]"),
  nbManageForm: document.querySelector("[data-nb-manage-form]"),
  nbManageName: document.querySelector("[data-nb-manage-name]"),
  nbManageParent: document.querySelector("[data-nb-manage-parent]"),
  mobileNotebooksModal: document.querySelector("[data-mobile-notebooks-modal]"),
  mobileModalOverlay: document.querySelector("[data-mobile-modal-overlay]"),
  mobileNotebooksList: document.querySelector("[data-mobile-notebooks-list]"),
  mobileNotebookForm: document.querySelector("[data-mobile-notebook-form]"),
  mobileNotebookName: document.querySelector("[data-mobile-notebook-name]"),
  mobileNotebookParent: document.querySelector("[data-mobile-notebook-parent]"),
  mobileFormatBar: document.querySelector("[data-mobile-format-bar]"),
  scratchpad: document.querySelector("[data-scratchpad]"),
  homePinnedSection: document.querySelector("[data-home-pinned-section]"),
  homePinned: document.querySelector("[data-home-pinned]"),
  homeDate: document.querySelector("[data-home-date]"),
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
  formatExtra: document.querySelector("[data-format-extra]"),
  formatExtraToggle: document.querySelector("[data-action='toggle-format-extra']"),
  formatButtons: document.querySelectorAll("[data-format]"),
  formatColorInputs: document.querySelectorAll("[data-format-color]"),
  formatSelects: document.querySelectorAll("[data-format-select]"),
  historyList: document.querySelector("[data-history-list]"),
  toggleFavorite: document.querySelector("[data-action='toggle-favorite']"),
  insertChecklist: document.querySelector("[data-action='insert-checklist']"),
  settingsPanel: document.querySelector("[data-settings-panel]"),
  homeView: document.querySelector("[data-home-view]"),
  homeRecent: document.querySelector("[data-home-recent]"),
  homeNotebooks: document.querySelector("[data-home-notebooks]"),
  homeGreeting: document.querySelector("[data-home-greeting]"),
  floatingToolbar: document.querySelector("[data-floating-toolbar]"),
  editorBreadcrumb: document.querySelector("[data-editor-breadcrumb]"),
  noteListPanel: document.querySelector("[data-note-list-panel]"),
  editorPanel: document.querySelector(".editor"),
  mobileTabs: document.querySelector("[data-mobile-tabs]"),
  searchBar: document.querySelector("[data-search-bar]"),
  noteListFocusSearch: document.querySelector("[data-action='focus-search']"),
  confirmSaveSearch: document.querySelector("[data-action='confirm-save-search']"),
  wordCount: document.querySelector("[data-word-count]"),
  focusMode: document.querySelector("[data-action='focus-mode']")
};

const shortcutFormats = {
  b: "bold",
  i: "italic",
  u: "underline"
};

const toolbarFonts = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  system: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  rounded: '"SF Pro Rounded", "Avenir Next", Nunito, sans-serif',
  editorial: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif',
  humanist: 'Avenir, "Avenir Next", "Trebuchet MS", sans-serif',
  code: '"SF Mono", "Roboto Mono", Menlo, Consolas, monospace'
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

function firstImageSrc(note) {
  if (!note.body) return null;
  // Fast regex — look for first img src in the body HTML
  const match = note.body.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
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

function isImageFile(file) {
  const name = String(file?.name || "");
  return Boolean(file?.type?.startsWith("image/"))
    || /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i.test(name);
}

function isImageAttachment(attachment) {
  const name = String(attachment?.filename || "");
  return Boolean(attachment?.mimeType?.startsWith("image/"))
    || /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i.test(name);
}

async function createAttachmentThumbnail(file) {
  if (!isImageFile(file)) return null;

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

function syncCurrentNotePreviewFromEditor() {
  const note = currentNote();
  if (!note) return;
  note.body = getEditorHtml();
  note.bodyFormat = "html";
  renderNotes();
  renderHomeView();
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

function sanitizeCssLength(value, { max = 240 } = {}) {
  const length = String(value || "").trim().toLowerCase();
  const match = length.match(/^(\d{1,3})px$/);
  if (!match) return "";
  const pixels = Number(match[1]);
  return pixels >= 0 && pixels <= max ? `${pixels}px` : "";
}

function sanitizeInlineStyle(element) {
  const declarations = [];
  const color = sanitizeCssColor(element.style.color);
  const backgroundColor = sanitizeCssColor(element.style.backgroundColor);
  const fontFamily = sanitizeCssFontFamily(element.style.fontFamily);
  const fontSize = sanitizeCssFontSize(element.style.fontSize);
  const marginLeft = sanitizeCssLength(element.style.marginLeft);
  const textAlign = ["left", "center", "right"].includes(element.style.textAlign)
    ? element.style.textAlign
    : "";

  if (color) declarations.push(`color: ${color}`);
  if (backgroundColor) declarations.push(`background-color: ${backgroundColor}`);
  if (fontFamily) declarations.push(`font-family: ${fontFamily}`);
  if (fontSize) declarations.push(`font-size: ${fontSize}`);
  if (marginLeft && marginLeft !== "0px") declarations.push(`margin-left: ${marginLeft}`);
  if (textAlign) declarations.push(`text-align: ${textAlign}`);

  return declarations.join("; ");
}

function sanitizeHtml(html) {
  const root = document.createElement("div");
  root.innerHTML = String(html || "");
  const allowedTags = new Set([
    "a", "blockquote", "br", "code", "div", "em", "h2", "h3", "h4", "hr", "img", "input",
    "li", "ol", "p", "pre", "s", "span", "strong", "sub", "sup", "table", "tbody", "td", "th", "thead", "tr", "u", "ul"
  ]);
  const styleAllowedTags = new Set(["blockquote", "div", "h2", "h3", "h4", "li", "p", "span", "td", "th"]);
  const classAllowList = {
    li: new Set(["complete", "task-item"]),
    span: new Set(["checklist-text"]),
    table: new Set(["note-table", "bear-table"]),
    ul: new Set(["checklist"])
  };

  function unwrap(element) {
    element.replaceWith(...Array.from(element.childNodes));
  }

  function safeImageSrc(src) {
    if (!src) return "";
    if (src.startsWith("blob:") || src.startsWith("data:image/") || src.startsWith("/api/attachments/")) {
      return src;
    }
    try {
      const url = new URL(src, window.location.origin);
      if (url.origin === window.location.origin && url.pathname.startsWith("/api/attachments/")) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      return "";
    }
    return "";
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
    const imgSrc = tag === "img" ? element.getAttribute("src") : null;
    const imgAlt = tag === "img" ? element.getAttribute("alt") : null;
    const imgWidth = tag === "img" ? element.getAttribute("width") || element.style.width || null : null;

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

    if (tag === "img") {
      const safeSrc = safeImageSrc(imgSrc || "");
      if (!safeSrc) {
        element.remove();
        return;
      }
      const alt = (imgAlt || "").slice(0, 300);
      element.setAttribute("src", safeSrc);
      if (alt) element.setAttribute("alt", alt);
      element.setAttribute("class", "note-img");
      if (imgWidth) {
        const w = String(imgWidth).trim();
        // Allow percentage widths (e.g. "25%", "100%") or plain integers (pixel widths)
        if (/^\d+%$/.test(w) || /^\d+$/.test(w)) element.setAttribute("width", w);
      }
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

function draftSignature(draft = currentDraft()) {
  return JSON.stringify({
    notebookId: draft.notebookId || null,
    title: String(draft.title || "").trim(),
    body: draft.body || "",
    tags: draft.tags || []
  });
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

function scheduleAutoSave() {
  window.clearTimeout(state.autoSaveTimer);
  if (!hasMeaningfulDraft()) return;
  state.autoSaveTimer = window.setTimeout(autoSaveNote, autoSaveDelayMs);
}

async function autoSaveNote() {
  if (!hasMeaningfulDraft()) return;
  const draft = currentDraft();
  const signature = draftSignature(draft);
  if (signature === state.lastAutoSaveSignature) return;
  state.lastAutoSaveSignature = signature;
  await saveNote({ autosave: true });
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
  updateWordCount();
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
    return true;
  });
}

function filteredNotes() {
  return visibleNotes().filter(noteMatchesSearch);
}


function updateWordCount() {
  if (!elements.wordCount) return;
  const text = (elements.body?.innerText || "").trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const chars = text.length;
  elements.wordCount.textContent = `${words.toLocaleString()} ${words === 1 ? "word" : "words"} · ${chars.toLocaleString()} chars`;
}

function placeEditorCaretAtEnd() {
  if (!elements.body) return;
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(elements.body);
  range.collapse(false);
  sel?.removeAllRanges();
  sel?.addRange(range);
  savedSelection = range.cloneRange();
}

function placeCaretInNode(node, collapseToEnd = true) {
  if (!node) return;
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(node);
  range.collapse(!collapseToEnd);
  sel?.removeAllRanges();
  sel?.addRange(range);
  savedSelection = range.cloneRange();
}

function notifyEditorChanged() {
  updateWordCount();
  saveDraftCache();
  renderTasks();
  elements.body?.dispatchEvent(new Event("input", { bubbles: true }));
}

function selectedTableCell() {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return null;
  let node = sel.getRangeAt(0).startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  return node?.closest?.("td, th") || null;
}

function setFocusModeButtonState(entering) {
  if (!elements.focusMode) return;
  elements.focusMode.title = entering ? "Exit focus mode (Esc)" : "Focus mode";
  elements.focusMode.setAttribute("aria-pressed", entering ? "true" : "false");
  const labelNode = Array.from(elements.focusMode.childNodes).find(
    (node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0
  );
  if (labelNode) labelNode.nodeValue = entering ? " Exit" : " Focus";
}

function enterFocusMode() {
  const shell = elements.appShell;
  if (!shell) return;

  state.focusModeReturnState = {
    filter: state.filter,
    notebookFilter: state.notebookFilter,
    tagFilter: state.tagFilter,
    mobilePanel: state.mobilePanel
  };

  if (state.filter === "home") {
    state.filter = "all";
    state.notebookFilter = null;
    state.tagFilter = null;
    updateNavigationState();
  }

  shell.classList.add("focus-mode");
  document.body.toggleAttribute("data-focus-mode", true);
  elements.homeView.hidden = true;
  elements.noteListPanel.hidden = true;
  if (elements.editorPanel) elements.editorPanel.hidden = false;
  setMobilePanel("editor");
  setFocusModeButtonState(true);
  elements.body?.focus();
  placeEditorCaretAtEnd();
}

function toggleFocusMode() {
  const shell = elements.appShell;
  if (!shell) return;
  const entering = !shell.classList.contains("focus-mode");
  if (entering) {
    enterFocusMode();
  } else {
    exitFocusMode();
  }
}

function exitFocusMode() {
  elements.appShell?.classList.remove("focus-mode");
  document.body.removeAttribute("data-focus-mode");
  if (state.focusModeReturnState) {
    state.filter = state.focusModeReturnState.filter;
    state.notebookFilter = state.focusModeReturnState.notebookFilter;
    state.tagFilter = state.focusModeReturnState.tagFilter;
    state.mobilePanel = state.focusModeReturnState.mobilePanel;
    state.focusModeReturnState = null;
  }
  setFocusModeButtonState(false);
  updateNavigationState();
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
  // Don't touch panel visibility while focus mode is active — it manages its own layout.
  if (elements.appShell?.classList.contains("focus-mode")) return;

  const isHome = state.filter === "home";

  // Show/hide home view vs note list + editor
  elements.homeView.hidden = !isHome;
  elements.noteListPanel.hidden = isHome;
  if (elements.editorPanel) elements.editorPanel.hidden = isHome;

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
  // Tasks panel removed — checklist items still work in the editor body
  // but the sidebar task tracker is gone. This is now a no-op.
}

// Save the selection so toolbar button clicks don't lose it.
let savedSelection = null;

function saveSelection() {
  if (state.suppressSelectionSave) return;
  captureEditorSelection();
}

function captureEditorSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (selectionIsInEditor(range)) {
      savedSelection = range.cloneRange();
      return true;
    }
  }
  return false;
}

function restoreSelection() {
  if (!selectionIsInEditor(savedSelection)) {
    savedSelection = null;
    return;
  }
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(savedSelection);
  }
}

function cloneEditorSelection() {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return null;
  const range = sel.getRangeAt(0);
  return selectionIsInEditor(range) ? range.cloneRange() : null;
}

function restoreEditorSelection(range) {
  if (!selectionIsInEditor(range)) return;
  const sel = window.getSelection();
  state.suppressSelectionSave = true;
  sel?.removeAllRanges();
  sel?.addRange(range);
  savedSelection = range.cloneRange();
  requestAnimationFrame(() => {
    state.suppressSelectionSave = false;
  });
}

function nodePathFromEditor(node) {
  const path = [];
  while (node && node !== elements.body) {
    const parent = node.parentNode;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, node));
    node = parent;
  }
  return node === elements.body ? path : null;
}

function nodeFromEditorPath(path) {
  let node = elements.body;
  for (const index of path || []) {
    node = node?.childNodes?.[index];
    if (!node) return null;
  }
  return node;
}

function selectionBookmark(range) {
  if (!selectionIsInEditor(range)) return null;
  return {
    startPath: nodePathFromEditor(range.startContainer),
    startOffset: range.startOffset,
    endPath: nodePathFromEditor(range.endContainer),
    endOffset: range.endOffset
  };
}

function restoreSelectionBookmark(bookmark) {
  if (!bookmark?.startPath || !bookmark?.endPath) return false;
  const startNode = nodeFromEditorPath(bookmark.startPath);
  const endNode = nodeFromEditorPath(bookmark.endPath);
  if (!startNode || !endNode) return false;

  const clampOffset = (node, offset) => {
    const max = node.nodeType === Node.TEXT_NODE ? node.nodeValue.length : node.childNodes.length;
    return Math.min(offset, max);
  };

  const range = document.createRange();
  range.setStart(startNode, clampOffset(startNode, bookmark.startOffset));
  range.setEnd(endNode, clampOffset(endNode, bookmark.endOffset));
  restoreEditorSelection(range);
  return true;
}

function editorSnapshot() {
  return elements.body?.innerHTML || "";
}

function restoreEditorSnapshot(html) {
  if (!elements.body) return;
  elements.body.innerHTML = sanitizeHtml(html);
  placeCaretInNode(elements.body, true);
  notifyEditorChanged();
}

function pushEditorUndoSnapshot(snapshot = editorSnapshot()) {
  state.editorUndoStack.push(snapshot);
  if (state.editorUndoStack.length > 80) state.editorUndoStack.shift();
  state.editorRedoStack = [];
}

function undoEditorChange() {
  if (!state.editorUndoStack.length) {
    document.execCommand("undo", false, null);
    saveSelection();
    notifyEditorChanged();
    return;
  }

  const previous = state.editorUndoStack.pop();
  state.editorRedoStack.push(editorSnapshot());
  restoreEditorSnapshot(previous);
}

function redoEditorChange() {
  if (!state.editorRedoStack.length) {
    document.execCommand("redo", false, null);
    saveSelection();
    notifyEditorChanged();
    return;
  }

  const next = state.editorRedoStack.pop();
  state.editorUndoStack.push(editorSnapshot());
  restoreEditorSnapshot(next);
}

// Format toolbar is now a static sticky bar — no positioning needed.
function updateFloatingToolbar() { /* no-op — toolbar is always visible */ }

function editorExec(command, value = null) {
  elements.body.focus();
  restoreSelection();
  document.execCommand(command, false, value);
  saveDraftCache();
  renderTasks();
  scheduleAutoSave();
}

function insertChecklistItem() {
  const item = document.createElement("li");
  item.className = "task-item";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.setAttribute("data-task-check", "");
  const text = document.createElement("span");
  text.className = "checklist-text";
  text.innerHTML = "<br>";
  item.append(checkbox, text);

  const range = selectionIsInEditor(savedSelection)
    ? savedSelection.cloneRange()
    : cloneEditorSelection();
  let inserted = item;

  if (range) {
    restoreEditorSelection(range);
    let node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const currentItem = node?.closest?.("ul.checklist > li");

    if (currentItem) {
      currentItem.after(item);
    } else {
      const list = document.createElement("ul");
      list.className = "checklist";
      list.append(item);
      let block = node?.closest?.("p, div, blockquote, h2, h3, h4, ul, ol, table");
      while (block?.parentElement && block.parentElement !== elements.body) {
        block = block.parentElement;
      }
      if (block && block.parentElement === elements.body) {
        block.after(list);
      } else {
        elements.body.append(list);
      }
    }
  } else {
    const list = document.createElement("ul");
    list.className = "checklist";
    list.append(item);
    elements.body.append(list);
  }

  placeCaretInNode(inserted.querySelector(".checklist-text"), false);
  notifyEditorChanged();
}

function insertInlineTable() {
  elements.body.focus();

  const table = document.createElement("table");
  table.className = "note-table bear-table";
  table.setAttribute("data-note-table", "");
  table.innerHTML =
    "<thead><tr><th>Header</th><th>Header</th><th>Header</th></tr></thead>" +
    "<tbody>" +
    "<tr><td><br></td><td><br></td><td><br></td></tr>" +
    "<tr><td><br></td><td><br></td><td><br></td></tr>" +
    "</tbody>";

  const after = document.createElement("p");
  after.innerHTML = "<br>";

  // Find the direct-child block of the editor that contains the cursor,
  // and insert the table after it. Fall back to appending at the end.
  const sel = window.getSelection();
  let insertAfterNode = null;

  // Use savedSelection first (set on toolbar mousedown), then live selection.
  const activeRange = savedSelection && selectionIsInEditor(savedSelection)
    ? savedSelection
    : (sel?.rangeCount ? sel.getRangeAt(0) : null);

  if (activeRange && selectionIsInEditor(activeRange)) {
    let node = activeRange.startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    while (node && node.parentElement !== elements.body) {
      node = node.parentElement;
    }
    if (node && node.parentElement === elements.body) insertAfterNode = node;
  }

  if (insertAfterNode) {
    insertAfterNode.after(table, after);
  } else {
    elements.body.appendChild(table);
    elements.body.appendChild(after);
  }

  // Place caret in the first body cell
  const firstBodyCell = table.querySelector("tbody td");
  if (firstBodyCell) {
    placeCaretInNode(firstBodyCell, false);
  }
  table.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  notifyEditorChanged();
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
  // Always keep task-item; toggle complete to reflect state.
  liveLi.classList.add("task-item");
  liveLi.classList.toggle("complete", !isChecked);

  // Dispatch a synthetic input event so the editor's input handler
  // updates the status bar and draft cache, signalling unsaved changes.
  elements.body.dispatchEvent(new Event("input", { bubbles: true }));
}

function selectionIsInEditor(range) {
  if (!range || !elements.body) return false;
  const container = range.commonAncestorContainer;
  if (!container || !container.isConnected) return false;
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
  scheduleAutoSave();
  return true;
}

function selectedEditorBlocks(range = null) {
  if (!range) {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return [];
    range = sel.getRangeAt(0);
  }
  if (!selectionIsInEditor(range)) return [];

  const blockSelector = "p, div, blockquote, h2, h3, h4, li, td, th";
  const blockForNode = (node) => {
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const block = node?.closest?.(blockSelector);
    return block && elements.body.contains(block) ? block : null;
  };

  if (range.collapsed) {
    const block = blockForNode(range.startContainer);
    return block ? [block] : [];
  }

  const allBlocks = Array.from(elements.body.querySelectorAll(blockSelector));
  const blocks = allBlocks.filter((block) => {
    return range.intersectsNode(block);
  });

  if (blocks.length) {
    return blocks.filter((block) => !blocks.some((other) => other !== block && block.contains(other)));
  }

  const block = blockForNode(range.startContainer);
  return block ? [block] : [];
}

function applyBlockAlignment(alignment) {
  const currentSelection = selectionIsInEditor(savedSelection)
    ? savedSelection.cloneRange()
    : cloneEditorSelection();
  if (!currentSelection) return false;
  const bookmark = selectionBookmark(currentSelection);

  const blocks = selectedEditorBlocks(currentSelection);
  if (!blocks.length) return false;

  blocks.forEach((block) => {
    block.style.textAlign = alignment;
  });
  restoreSelectionBookmark(bookmark);
  return true;
}

function applyBlockIndent(direction) {
  const currentSelection = selectionIsInEditor(savedSelection)
    ? savedSelection.cloneRange()
    : cloneEditorSelection();
  if (!currentSelection) return false;
  const bookmark = selectionBookmark(currentSelection);

  const blocks = selectedEditorBlocks(currentSelection);
  if (!blocks.length) return false;

  const step = 32;
  const max = 192;
  blocks.forEach((block) => {
    const current = Number.parseInt(block.style.marginLeft || "0", 10) || 0;
    const next = direction === "in"
      ? Math.min(max, current + step)
      : Math.max(0, current - step);
    if (next) {
      block.style.marginLeft = `${next}px`;
    } else {
      block.style.removeProperty("margin-left");
    }
  });
  restoreSelectionBookmark(bookmark);
  return true;
}

function applyToolbarSelect(kind, value) {
  elements.body.focus();
  restoreSelection();

  if (kind === "block") {
    document.execCommand("formatBlock", false, value || "p");
    saveDraftCache();
    renderTasks();
    scheduleAutoSave();
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
  if (format === "undo" || format === "redo") {
    if (format === "undo") {
      undoEditorChange();
    } else {
      redoEditorChange();
    }
    return;
  }

  const beforeHtml = editorSnapshot();
  const isAlignmentFormat = format === "align-left" || format === "align-center" || format === "align-right";

  if (format === "checklist") {
    insertChecklistItem();
    if (editorSnapshot() !== beforeHtml) {
      pushEditorUndoSnapshot(beforeHtml);
    }
    return;
  }

  elements.body.focus();
  restoreSelection();
  const alignmentBookmark = isAlignmentFormat
    ? selectionBookmark(savedSelection || cloneEditorSelection())
    : null;

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
  else if (format === "image") {
    saveSelection();
    const imageSelection = savedSelection ? savedSelection.cloneRange() : null;
    // Open a file picker — works on both desktop and mobile
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (file) insertImageFileIntoEditor(file, imageSelection);
    }, { once: true });
    input.click();
    return; // don't call saveDraftCache yet — async
  }
  else if (format === "table") {
    insertInlineTable();
    return;
  }
  else if (format === "clear") {
    document.execCommand("removeFormat", false, null);
  }

  if (editorSnapshot() !== beforeHtml) {
    pushEditorUndoSnapshot(beforeHtml);
  }
  notifyEditorChanged();
  if (alignmentBookmark) {
    restoreSelectionBookmark(alignmentBookmark);
    requestAnimationFrame(() => restoreSelectionBookmark(alignmentBookmark));
  }
}

function renderAttachments() {
  if (!elements.attachmentList) return;

  const displayAttachments = state.attachments.filter((attachment) => !isImageAttachment(attachment));
  const fileAttachments = displayAttachments;

  // Show/hide the whole attachments section
  if (elements.inlineAttachments) {
    elements.inlineAttachments.hidden = !displayAttachments.length;
  }
  if (elements.attachmentCount) {
    const fileLabel = fileAttachments.length
      ? `${fileAttachments.length} file${fileAttachments.length === 1 ? "" : "s"}`
      : "";
    elements.attachmentCount.textContent = fileLabel;
  }

  if (!displayAttachments.length) {
    elements.attachmentList.innerHTML = "";
    return;
  }

  elements.attachmentList.innerHTML = displayAttachments.map((attachment) => {
    return `
    <article class="attachment-item is-file">
      <a class="attachment-main" href="${attachment.downloadUrl}" target="_blank" rel="noopener">
        <span class="attachment-icon" aria-hidden="true">${escapeHtml((attachment.mimeType || "FILE").split("/").pop().toUpperCase().slice(0, 4))}</span>
        <div class="attachment-file-info">
          <span>${escapeHtml(attachment.filename)}</span>
          <small>${escapeHtml(formatBytes(attachment.sizeBytes))}</small>
        </div>
      </a>
      <div class="attachment-tools">
        <button type="button" data-attachment-replace="${attachment.id}">Replace</button>
        <button type="button" data-attachment-delete="${attachment.id}">Delete</button>
      </div>
    </article>`;
  }).join("");
}

function historyPreview(version) {
  const preview = String(version.body || "").replace(/\s+/g, " ").trim();
  return preview.slice(0, 120) || "No body";
}

function renderHistory(versions) {
  if (!elements.historyList) return;
}

// Track which notebook groups are collapsed (persisted in localStorage)
const collapsedNotebooks = new Set(
  JSON.parse(localStorage.getItem("edge_collapsed_notebooks") || "[]")
);

function saveCollapsedNotebooks() {
  localStorage.setItem("edge_collapsed_notebooks", JSON.stringify([...collapsedNotebooks]));
}

// Simple mobile notebook list — name, count, delete only. No desktop-only action buttons.
function renderMobileNotebookList(notebooks, parentId = null, depth = 0) {
  const children = notebooks.filter((nb) => (nb.parentId || null) === parentId);
  if (!children.length) return "";
  return children.map((nb) => {
    const indent = `style="padding-left:${depth * 16 + 12}px"`;
    const sub = renderMobileNotebookList(notebooks, nb.id, depth + 1);
    return `
      <div class="mobile-nb-row" data-nb-row="${nb.id}">
        <div class="mobile-nb-row-inner" ${indent}>
          <span class="mobile-nb-icon">${renderNotebookIcon(nb)}</span>
          <span class="mobile-nb-name">${escapeHtml(nb.name)}</span>
          <small class="mobile-nb-count">${nb.noteCount || 0}</small>
          <button type="button" class="mobile-nb-delete" data-notebook-delete="${nb.id}" aria-label="Delete ${escapeHtml(nb.name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
        ${sub}
      </div>`;
  }).join("");
}

function renderNotebookTree(notebooks, parentId = null, depth = 0) {
  const children = notebooks.filter((nb) => (nb.parentId || null) === parentId);
  if (!children.length) return "";

  return children.map((notebook) => {
    const subtree = renderNotebookTree(notebooks, notebook.id, depth + 1);
    const hasChildren = subtree.length > 0;
    const isCollapsed = collapsedNotebooks.has(notebook.id);
    const indent = depth > 0 ? `style="padding-left:${depth * 14}px"` : "";

    return `
      <div class="notebook-row${hasChildren ? " has-children" : ""}${hasChildren && !isCollapsed ? " expanded" : ""}" data-notebook-id="${notebook.id}">
        <div class="notebook-row-inner" ${indent}>
          ${hasChildren ? `
            <button type="button" class="notebook-chevron" data-notebook-toggle="${notebook.id}" aria-label="Toggle" title="Expand/collapse">
              <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ` : ``}
          <a href="#notebook-${notebook.id}" data-notebook-filter="${notebook.id}" class="notebook-row-link${hasChildren ? "" : " no-chevron"}">
            <span class="notebook-icon">${renderNotebookIcon(notebook)}</span>
            <span class="notebook-row-name">${escapeHtml(notebook.name)}</span>
            <small>${notebook.noteCount || 0}</small>
          </a>
          <div class="notebook-row-actions">
            <button type="button" class="btn-notebook-icon" data-notebook-icon="${notebook.id}" aria-label="Change icon" title="Change icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            </button>
            <button type="button" class="btn-notebook-rename" data-notebook-rename="${notebook.id}" aria-label="Rename" title="Rename">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
            </button>
            <button type="button" class="btn-notebook-move" data-notebook-move="${notebook.id}" aria-label="Move / nest" title="Move / nest">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l-3 3 3 3"/><path d="M2 12h14"/><path d="M19 4v7a4 4 0 0 1-4 4H2"/></svg>
            </button>
            <button type="button" class="btn-notebook-delete" data-notebook-delete="${notebook.id}" aria-label="Delete" title="Delete">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
        </div>
        ${hasChildren ? `<div class="notebook-children${isCollapsed ? " collapsed" : ""}">${subtree}</div>` : ""}
      </div>
    `;
  }).join("");
}

function buildNotebookParentOptions(excludeId = null) {
  // Build flat list of notebooks for parent selector, excluding the notebook being edited
  return [
    '<option value="">No parent (top level)</option>',
    ...state.notebooks
      .filter((nb) => nb.id !== excludeId)
      .map((nb) => {
        const prefix = nb.parentId ? "  └ " : "";
        return `<option value="${nb.id}">${prefix}${escapeHtml(nb.name)}</option>`;
      })
  ].join("");
}

function renderCollections() {
  const selectedNotebook = elements.notebook.value;
  const notebookOptions = [
    '<option value="">No notebook</option>',
    ...state.notebooks.map((notebook) => {
      const prefix = notebook.parentId ? "  └ " : "";
      return `<option value="${notebook.id}">${prefix}${escapeHtml(notebook.name)}</option>`;
    })
  ];

  elements.notebook.innerHTML = notebookOptions.join("");
  elements.notebook.value = selectedNotebook;

  // Populate parent selectors
  const parentOptions = buildNotebookParentOptions();
  if (elements.notebookParent) elements.notebookParent.innerHTML = parentOptions;
  if (elements.mobileNotebookParent) elements.mobileNotebookParent.innerHTML = parentOptions;
  if (elements.nbManageParent) elements.nbManageParent.innerHTML = parentOptions;

  const tree = renderNotebookTree(state.notebooks);
  elements.notebooksList.innerHTML = tree || '<span class="sidebar-empty">No notebooks yet</span>';

  // Also render mobile modal list (uses simpler mobile renderer) and desktop manage panel if open
  if (elements.mobileNotebooksList) {
    elements.mobileNotebooksList.innerHTML = renderMobileNotebookList(state.notebooks) || '<p class="home-empty">No notebooks yet.</p>';
  }
  if (elements.nbManageList && elements.nbManagePanel && !elements.nbManagePanel.hidden) {
    elements.nbManageList.innerHTML = tree || '<p style="padding:8px;color:var(--sb-ink-3);font-size:.8rem">No notebooks yet.</p>';
  }

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
    elements.homeNotebooks.innerHTML = '<p class="home-empty">No notebooks yet.</p>';
    return;
  }

  // Render as nested list: top-level notebooks, each followed by their children
  function notebookTile(notebook, depth = 0) {
    const children = state.notebooks.filter((nb) => nb.parentId === notebook.id);
    const tile = `
      <button class="home-notebook-card${depth > 0 ? " home-notebook-card-child" : ""}" type="button"
              data-notebook-filter="${notebook.id}" style="${depth > 0 ? `margin-left:${depth * 16}px` : ""}">
        <span class="home-notebook-icon">${renderNotebookIcon(notebook)}</span>
        <strong>${escapeHtml(notebook.name)}</strong>
        <span>${notebook.noteCount || 0} note${notebook.noteCount === 1 ? "" : "s"}</span>
      </button>
    `;
    return tile + children.map((child) => notebookTile(child, depth + 1)).join("");
  }

  const topLevel = state.notebooks.filter((nb) => !nb.parentId);
  elements.homeNotebooks.innerHTML = topLevel.map((nb) => notebookTile(nb)).join("");
}

function renderHomeView() {
  if (!elements.homeView || elements.homeView.hidden) return;

  // Date and greeting
  if (elements.homeGreeting) elements.homeGreeting.textContent = timeGreeting();
  if (elements.homeDate) {
    elements.homeDate.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "long", month: "long", day: "numeric"
    }).format(new Date());
  }

  // Restore scratchpad from localStorage
  if (elements.scratchpad && !elements.scratchpad.dataset.loaded) {
    elements.scratchpad.value = localStorage.getItem("edge_scratchpad") || "";
    elements.scratchpad.dataset.loaded = "1";
  }

  // Pinned / favorited notes
  const pinned = state.notes.filter((note) => note.favorite && !note.archivedAt).slice(0, 6);
  if (elements.homePinnedSection) {
    elements.homePinnedSection.hidden = pinned.length === 0;
  }
  if (elements.homePinned && pinned.length) {
    elements.homePinned.innerHTML = pinned.map((note) => {
      const thumb = firstImageSrc(note);
      return `
      <button class="home-card${thumb ? " home-card-has-thumb" : ""}" type="button" data-note-id="${note.id}">
        ${thumb ? `<img class="home-card-thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy" draggable="false">` : ""}
        <div class="home-card-body">
          <span class="home-card-notebook">${escapeHtml(note.notebookName || "Note")}</span>
          <h3 class="home-card-title">${escapeHtml(note.title || "Untitled note")}</h3>
          <p class="home-card-snippet">${escapeHtml(stripHtml(note.body).slice(0, 100) || "")}</p>
          <time class="home-card-date">${escapeHtml(formatDate(note.updatedAt))}</time>
        </div>
      </button>
    `;
    }).join("");
  }

  // Recent notes — up to 8 non-archived, non-pinned
  if (elements.homeRecent) {
    const recent = state.notes
      .filter((note) => !note.archivedAt)
      .slice(0, 8);

    if (!recent.length) {
      elements.homeRecent.innerHTML = '<p class="home-empty">No notes yet. Hit "New note" to get started.</p>';
    } else {
      elements.homeRecent.innerHTML = recent.map((note) => {
        const thumb = firstImageSrc(note);
        return `
        <button class="home-card${thumb ? " home-card-has-thumb" : ""}" type="button" data-note-id="${note.id}">
          ${thumb ? `<img class="home-card-thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy" draggable="false">` : ""}
          <div class="home-card-body">
            <span class="home-card-notebook">${escapeHtml(note.notebookName || "Note")}</span>
            <h3 class="home-card-title">${escapeHtml(note.title || "Untitled note")}</h3>
            <p class="home-card-snippet">${escapeHtml(stripHtml(note.body).slice(0, 120) || "")}</p>
            <time class="home-card-date">${escapeHtml(formatDate(note.updatedAt))}</time>
          </div>
        </button>
      `;
      }).join("");
    }
  }

  renderHomeNotebooks();
}

function renderNotes() {
  const notes = filteredNotes();
  const search = elements.search.value.trim();
  const childNotebooks = state.notebookFilter && !search && state.filter !== "archive"
    ? state.notebooks.filter((notebook) => Number(notebook.parentId || 0) === Number(state.notebookFilter))
    : [];
  updateNavigationState();
  elements.searchSummary.textContent = search
    ? `${notes.length} result${notes.length === 1 ? "" : "s"} for "${search}"`
    : `${notes.length} note${notes.length === 1 ? "" : "s"}${childNotebooks.length ? `, ${childNotebooks.length} folder${childNotebooks.length === 1 ? "" : "s"}` : ""} in ${viewLabel()}`;

  if (!notes.length && !childNotebooks.length) {
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

  const folderCards = childNotebooks.map((notebook) => `
    <article class="notebook-list-card" data-notebook-filter="${notebook.id}" tabindex="0" aria-label="Open ${escapeHtml(notebook.name)}">
      <span class="notebook-list-icon">${renderNotebookIcon(notebook)}</span>
      <div class="notebook-list-body">
        <span class="note-card-notebook">Folder</span>
        <h3 class="note-card-title">${escapeHtml(notebook.name)}</h3>
        <p class="note-card-snippet">${Number(notebook.noteCount || 0).toLocaleString()} direct note${Number(notebook.noteCount || 0) === 1 ? "" : "s"}</p>
      </div>
    </article>
  `).join("");

  const noteCards = notes.map((note) => {
    const thumb = firstImageSrc(note);
    return `
    <article class="note-card ${note.id === state.selectedId ? "active" : ""}${thumb ? " note-card-has-thumb" : ""}" data-note-id="${note.id}" tabindex="0">
      <div class="note-card-body">
        <span class="note-card-notebook">${escapeHtml(note.notebookName || (note.tags?.[0] ? `#${note.tags[0]}` : "Note"))}</span>
        <h3 class="note-card-title">${escapeHtml(note.title || "Untitled note")}${note.favorite ? ' <span class="note-card-star" aria-label="Favorite">★</span>' : ""}</h3>
        <p class="note-card-snippet">${escapeHtml(searchSnippet(note))}</p>
        <time class="note-card-date" datetime="${escapeHtml(note.updatedAt || "")}">${escapeHtml(formatDate(note.updatedAt))}</time>
      </div>
      ${thumb ? `<img class="note-card-thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy" draggable="false">` : ""}
    </article>
  `}).join("");

  elements.list.innerHTML = folderCards + noteCards;
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
    state.attachmentLimitMb = config.attachmentLimitMb || 25;
    if (elements.attachmentLimit) {
      elements.attachmentLimit.textContent = `Limit ${state.attachmentLimitMb} MB per file`;
    }
  } catch {
    // non-fatal
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

async function createNotebookApi({ name, parentId = null } = {}) {
  const payload = await requestJson("/api/notebooks", {
    method: "POST",
    body: JSON.stringify({ name, parentId: parentId || null })
  });
  state.notebooks = payload.notebooks || [];
  writeCache(cacheKeys.collections, {
    notebooks: state.notebooks,
    tags: state.tags,
    cachedAt: new Date().toISOString()
  });
  renderCollections();
  renderNotes();
  return state.notebooks.find((nb) => nb.name.toLowerCase() === name.toLowerCase());
}

async function createNotebookFromForm(event) {
  event.preventDefault();
  const name = elements.notebookName.value.trim();
  if (!name) return;
  const parentId = elements.notebookParent?.value ? Number(elements.notebookParent.value) : null;

  try {
    const created = await createNotebookApi({ name, parentId });
    elements.notebookName.value = "";
    if (elements.notebookParent) elements.notebookParent.value = "";
    if (elements.notebookForm) elements.notebookForm.hidden = true;
    if (created) {
      state.notebookFilter = created.id;
      state.tagFilter = null;
      state.filter = "all";
      elements.notebook.value = created.id;
    }
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

async function moveNotebook(notebookId) {
  const notebook = state.notebooks.find((nb) => nb.id === notebookId);
  if (!notebook) return;

  // Build the set of IDs that cannot be a parent (self + descendants)
  const excluded = new Set([notebookId]);
  function collectDescendants(id) {
    state.notebooks.filter((nb) => nb.parentId === id).forEach((nb) => {
      excluded.add(nb.id);
      collectDescendants(nb.id);
    });
  }
  collectDescendants(notebookId);

  // Render the picker tree recursively
  function pickerTree(parentId = null, depth = 0) {
    const children = state.notebooks.filter(
      (nb) => (nb.parentId || null) === parentId && !excluded.has(nb.id)
    );
    return children.map((nb) => {
      const isCurrent = nb.id === notebook.parentId;
      const indent = depth * 16;
      return `
        <button type="button" class="nb-move-option${isCurrent ? " nb-move-current" : ""}"
          data-move-target="${nb.id}" style="padding-left:${14 + indent}px">
          <span class="nb-move-icon">${renderNotebookIcon(nb)}</span>
          <span>${escapeHtml(nb.name)}</span>
          ${isCurrent ? '<span class="nb-move-badge">current</span>' : ""}
        </button>
        ${pickerTree(nb.id, depth + 1)}
      `;
    }).join("");
  }

  // Build and inject the popover
  const existing = document.getElementById("nb-move-popover");
  if (existing) existing.remove();

  const popover = document.createElement("div");
  popover.id = "nb-move-popover";
  popover.className = "nb-move-popover";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-label", `Move "${notebook.name}"`);
  popover.innerHTML = `
    <div class="nb-move-header">
      <span>Move <strong>${escapeHtml(notebook.name)}</strong> under…</span>
      <button type="button" class="nb-move-close" aria-label="Cancel">✕</button>
    </div>
    <div class="nb-move-list">
      <button type="button" class="nb-move-option${!notebook.parentId ? " nb-move-current" : ""}"
        data-move-target="null" style="padding-left:14px">
        <span class="nb-move-icon">${notebookIconSvg("folder", null)}</span>
        <span>Top level</span>
        ${!notebook.parentId ? '<span class="nb-move-badge">current</span>' : ""}
      </button>
      ${pickerTree()}
    </div>
  `;

  // Position near the move button that was clicked
  const moveBtn = document.querySelector(`[data-notebook-move="${notebookId}"]`);
  const anchor = moveBtn || document.body;
  document.body.appendChild(popover);

  if (moveBtn) {
    const rect = moveBtn.getBoundingClientRect();
    const top = rect.bottom + 6;
    const left = Math.min(rect.left, window.innerWidth - popover.offsetWidth - 12);
    popover.style.top = `${top}px`;
    popover.style.left = `${Math.max(8, left)}px`;
  } else {
    popover.style.top = "50%";
    popover.style.left = "50%";
    popover.style.transform = "translate(-50%, -50%)";
  }

  function closePopover() {
    popover.remove();
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("mousedown", onOutside);
  }

  async function applyMove(newParentId) {
    closePopover();
    try {
      const payload = await requestJson(`/api/notebooks/${notebookId}`, {
        method: "PATCH",
        body: JSON.stringify({ parentId: newParentId })
      });
      state.notebooks = payload.notebooks || [];
      writeCache(cacheKeys.collections, {
        notebooks: state.notebooks,
        tags: state.tags,
        cachedAt: new Date().toISOString()
      });
      renderCollections();
      renderNotes();
      setStatus("Notebook moved.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  popover.addEventListener("click", (e) => {
    const close = e.target.closest(".nb-move-close");
    if (close) { closePopover(); return; }
    const btn = e.target.closest("[data-move-target]");
    if (!btn) return;
    const raw = btn.getAttribute("data-move-target");
    const newParentId = raw === "null" ? null : Number(raw);
    applyMove(newParentId);
  });

  function onKey(e) { if (e.key === "Escape") closePopover(); }
  function onOutside(e) { if (!popover.contains(e.target) && !e.target.closest("[data-notebook-move]")) closePopover(); }
  document.addEventListener("keydown", onKey);
  setTimeout(() => document.addEventListener("mousedown", onOutside), 0);
}

// ── Notebook icon picker ─────────────────────────────────────────
const NOTEBOOK_ICONS = [
  { id: "notebook",       label: "Notebook" },
  { id: "book-open",      label: "Book open" },
  { id: "book",           label: "Book" },
  { id: "file-text",      label: "Document" },
  { id: "folder",         label: "Folder" },
  { id: "folder-open",    label: "Folder open" },
  { id: "archive",        label: "Archive" },
  { id: "star",           label: "Star" },
  { id: "heart",          label: "Heart" },
  { id: "bookmark",       label: "Bookmark" },
  { id: "tag",            label: "Tag" },
  { id: "pencil",         label: "Pencil" },
  { id: "lightbulb",      label: "Idea" },
  { id: "flask-conical",  label: "Research" },
  { id: "briefcase",      label: "Work" },
  { id: "graduation-cap", label: "Study" },
  { id: "house",          label: "Home" },
  { id: "camera",         label: "Camera" },
  { id: "music",          label: "Music" },
  { id: "dumbbell",       label: "Fitness" },
];

const NOTEBOOK_COLORS = [
  "#6b7280",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#0ea5e9",
];

function notebookIconSvg(iconId, color) {
  const c = color || "currentColor";
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="nb-svg-icon" style="color:${c}"><use href="#${iconId}"/></svg>`;
}

function renderNotebookIcon(nb) {
  const isLucide = nb.icon && !/\p{Emoji_Presentation}/u.test(nb.icon);
  if (isLucide) return notebookIconSvg(nb.icon, nb.iconColor);
  if (nb.icon) return `<span aria-hidden="true">${nb.icon}</span>`;
  return notebookIconSvg("notebook", null);
}

async function setNotebookIcon(notebookId) {
  const notebook = state.notebooks.find((nb) => nb.id === notebookId);
  if (!notebook) return;

  document.getElementById("nb-icon-picker")?.remove();

  const currentIcon = (notebook.icon && !/\p{Emoji_Presentation}/u.test(notebook.icon))
    ? notebook.icon : "notebook";
  const currentColor = notebook.iconColor || NOTEBOOK_COLORS[0];

  const picker = document.createElement("div");
  picker.id = "nb-icon-picker";
  picker.className = "nb-icon-picker";
  picker.setAttribute("role", "dialog");
  picker.setAttribute("aria-label", "Choose notebook icon");

  picker.innerHTML = `
    <div class="nb-icon-picker-header">
      <span>Notebook icon</span>
      <button type="button" class="nb-icon-picker-close" aria-label="Close">
        <svg viewBox="0 0 24 24"><use href="#x"/></svg>
      </button>
    </div>
    <div class="nb-icon-picker-icons">
      ${NOTEBOOK_ICONS.map(({ id, label }) => `
        <button type="button" class="nb-icon-option${currentIcon === id ? " selected" : ""}"
          data-icon-id="${id}" title="${label}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#${id}"/></svg>
        </button>
      `).join("")}
    </div>
    <div class="nb-icon-picker-colors">
      ${NOTEBOOK_COLORS.map(color => `
        <button type="button" class="nb-color-swatch${currentColor === color ? " selected" : ""}"
          data-icon-color="${color}" title="${color}" style="background:${color}"></button>
      `).join("")}
    </div>
    <div class="nb-icon-picker-footer">
      <button type="button" class="nb-icon-picker-save">Apply</button>
    </div>
  `;

  document.body.appendChild(picker);

  // Position near the trigger button, fallback to center of screen
  const triggerBtn = document.querySelector(`[data-notebook-icon="${notebookId}"]`);
  const pickerW = 248;
  if (triggerBtn) {
    const rect = triggerBtn.getBoundingClientRect();
    if (rect.width > 0) {
      // Button is visible — position below it
      let left = rect.left + window.scrollX;
      if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;
      picker.style.position = "fixed";
      picker.style.top = `${rect.bottom + 6}px`;
      picker.style.left = `${Math.max(8, rect.left)}px`;
    } else {
      // Button is hidden/zero-size — center on screen
      picker.style.position = "fixed";
      picker.style.top = "50%";
      picker.style.left = "50%";
      picker.style.transform = "translate(-50%, -50%)";
    }
  } else {
    picker.style.position = "fixed";
    picker.style.top = "50%";
    picker.style.left = "50%";
    picker.style.transform = "translate(-50%, -50%)";
  }

  let selectedIcon = currentIcon;
  let selectedColor = currentColor;

  function updatePreview() {
    picker.querySelectorAll(".nb-icon-option").forEach(btn => {
      const active = btn.dataset.iconId === selectedIcon;
      btn.classList.toggle("selected", active);
      btn.querySelector("svg").style.color = selectedColor;
    });
    picker.querySelectorAll(".nb-color-swatch").forEach(btn => {
      btn.classList.toggle("selected", btn.dataset.iconColor === selectedColor);
    });
  }

  picker.addEventListener("click", async (e) => {
    const iconBtn = e.target.closest("[data-icon-id]");
    if (iconBtn) { selectedIcon = iconBtn.dataset.iconId; updatePreview(); return; }

    const colorBtn = e.target.closest("[data-icon-color]");
    if (colorBtn) { selectedColor = colorBtn.dataset.iconColor; updatePreview(); return; }

    if (e.target.closest(".nb-icon-picker-close")) { picker.remove(); return; }

    if (e.target.closest(".nb-icon-picker-save")) {
      picker.remove();
      try {
        const payload = await requestJson(`/api/notebooks/${notebookId}`, {
          method: "PATCH",
          body: JSON.stringify({ icon: selectedIcon, iconColor: selectedColor })
        });
        state.notebooks = payload.notebooks || [];
        writeCache(cacheKeys.collections, {
          notebooks: state.notebooks,
          tags: state.tags,
          cachedAt: new Date().toISOString()
        });
        renderCollections();
      } catch (error) {
        setStatus(error.message);
      }
    }
  });

  setTimeout(() => {
    document.addEventListener("mousedown", function onOutside(e) {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener("mousedown", onOutside);
      }
    });
  }, 0);

  updatePreview();
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

async function saveNote({ autosave = false } = {}) {
  // If a save is already in flight, mark that we need another save and bail.
  // The in-flight save will re-run once it finishes (see finally block below).
  if (state.pendingSave) {
    state.saveAgainRequested = true;
    return;
  }
  window.clearTimeout(state.autoSaveTimer);
  state.pendingSave = true;
  state.saveAgainRequested = false;
  elements.saveNote.textContent = "Saving";
  setStatus(autosave ? "Autosaving..." : "Saving...");

  try {
    const draft = currentDraft();
    const isNewNote = !state.selectedId;
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

    // Fix: when saving the already-open note, do NOT re-render the editor body
    // from the server response — that would overwrite any content (like a freshly
    // inserted image) that was added after currentDraft() was captured above.
    // Only do a full selectNote() re-render when creating a brand-new note,
    // since we need to acquire the new ID and switch the editor into edit mode.
    if (isNewNote) {
      selectNote(saved);
    } else {
      // Refresh state and metadata without touching the editor DOM
      state.selectedId = saved.id;
      elements.notebook.value = saved.notebookId || "";
      elements.tags.value = (saved.tags || []).join(", ");
      elements.title.value = saved.title || "Untitled note";
      if (elements.editorBreadcrumb) {
        const notebook = saved.notebookId
          ? state.notebooks.find((nb) => nb.id === saved.notebookId)
          : null;
        elements.editorBreadcrumb.textContent = notebook?.name || viewLabel();
      }
      renderEditorActions(saved);
      renderNotes();
      writeCache(cacheKeys.selectedId, saved.id);
    }

    state.localDraftRestored = false;
    state.lastAutoSaveSignature = draftSignature(saved);
    clearDraftCache();
    writeCache(cacheKeys.notes, {
      notes: state.notes,
      cachedAt: new Date().toISOString()
    });
    await loadCollections();
    await loadHistory(saved.id);
    setStatus(`${autosave ? "Autosaved" : "Saved"} ${formatDate(saved.updatedAt)}`);
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
    // If something requested a re-save while we were in flight, run it now
    // so the latest editor contents (e.g. a freshly inserted image) get persisted.
    if (state.saveAgainRequested) {
      state.saveAgainRequested = false;
      saveNote();
    }
  }
}

function insertImageUrl(src, alt = "", insertionRange = savedSelection, options = {}) {
  const shouldPersist = options.persist !== false;
  const uploadToken = options.uploadToken || "";
  if (selectionIsInEditor(insertionRange)) {
    savedSelection = insertionRange.cloneRange();
  } else if (!selectionIsInEditor(savedSelection)) {
    savedSelection = null;
  }
  restoreSelection();

  const img = document.createElement("img");
  img.setAttribute("src", src);
  img.alt = alt;
  img.className = "note-img";
  img.setAttribute("width", "100%");
  if (uploadToken) {
    img.dataset.uploadToken = uploadToken;
  }
  // Wrap in a <p> so it sits on its own line
  const wrapper = document.createElement("p");
  wrapper.appendChild(img);
  const br = document.createElement("p");
  br.innerHTML = "<br>";

  elements.body.focus();

  // Try to insert at current cursor position; if no valid selection in editor,
  // fall back to appending at the end.
  const sel = window.getSelection();
  const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  const inEditor = selectionIsInEditor(range);

  if (inEditor) {
    range.deleteContents();
    range.insertNode(br.cloneNode(true));
    range.insertNode(wrapper);
    range.setStartAfter(wrapper);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    // Place cursor at end of editor then insert
    const endRange = document.createRange();
    endRange.selectNodeContents(elements.body);
    endRange.collapse(false);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(endRange);
    }
    elements.body.appendChild(wrapper);
    elements.body.appendChild(br.cloneNode(true));
    // Move cursor after the inserted image
    const afterRange = document.createRange();
    afterRange.setStartAfter(wrapper);
    afterRange.collapse(true);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(afterRange);
    }
  }
  if (shouldPersist) {
    elements.body.dispatchEvent(new Event("input", { bubbles: true }));
    saveDraftCache();
    syncCurrentNotePreviewFromEditor();
  }
}

async function uploadImageAttachment(file) {
  let noteId = state.selectedId;
  if (!noteId) return null;

  const form = new FormData();
  form.append("file", file, file.name);
  const thumbnail = await createAttachmentThumbnail(file);
  if (thumbnail) form.append("thumbnail", thumbnail, "thumbnail.webp");

  const response = await fetch(`/api/notes/${noteId}/attachments`, {
    method: "POST",
    body: form
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || payload.message || `Upload failed (${response.status})`);
  return payload.attachment;
}

async function insertImageFileIntoEditor(file, insertionRange = savedSelection, options = {}) {
  setStatus(`Embedding ${file.name}...`);
  try {
    if (!state.selectedId) {
      const saved = await saveNote();
      if (!saved) return;
      insertionRange = null;
    }

    const attachment = await uploadImageAttachment(file);
    if (!attachment?.downloadUrl) {
      throw new Error("Image uploaded without a usable URL");
    }

    // Insert the img into the editor DOM BEFORE saving, so that currentDraft()
    // inside saveNote() captures the body that includes this image.
    insertImageUrl(attachment.downloadUrl, attachment.filename || file.name, insertionRange, { persist: true });
    state.attachments.unshift(attachment);
    renderAttachments();
    syncCurrentNotePreviewFromEditor();

    // Only save here if the caller hasn't requested we skip it (multi-image loop
    // does a single save after all images are inserted).
    if (!options.skipSave) {
      const saved = await saveNote();
      // Verify the image URL actually made it into the persisted body
      const persisted = saved?.body?.includes(attachment.downloadUrl);
      setStatus(persisted ? `Image embedded: ${attachment.filename}` : `Image uploaded but not yet saved — try saving manually`);
    }
  } catch (error) {
    console.error("Image upload error:", error);
    setStatus(`Image upload failed: ${error.message}`);
  }
}

// Upload one or more files from the inline attach bar file input.
async function uploadAttachmentFiles(files) {
  if (!files || !files.length) return;

  const incoming = Array.from(files);
  const images = incoming.filter(isImageFile);
  const others = incoming.filter((file) => !isImageFile(file));
  if (images.length) {
    const imageSelection = savedSelection ? savedSelection.cloneRange() : null;
    // Insert all images first (skipSave=true), then do ONE save so the body
    // snapshot includes every image and there's no overlapping-save contention.
    for (const file of images) {
      await insertImageFileIntoEditor(file, imageSelection, { skipSave: true });
    }
    await saveNote();
  }
  if (!others.length) return;

  let noteId = state.selectedId;
  if (!noteId) {
    const saved = await saveNote();
    noteId = saved?.id;
  }
  if (!noteId) {
    setStatus("Save the note before adding attachments");
    return;
  }

  const label = elements.attachmentFile?.closest("label");
  const originalText = label?.querySelector("span")?.textContent || "Add photo or file";
  if (label) label.querySelector("span") && (label.querySelector("span").textContent = "Uploading…");

  for (const file of others) {
    if (file.size > state.attachmentLimitMb * 1024 * 1024) {
      setStatus(`"${file.name}" exceeds ${state.attachmentLimitMb} MB limit`);
      continue;
    }
    try {
      const form = new FormData();
      form.append("file", file);
      const thumbnail = await createAttachmentThumbnail(file);
      if (thumbnail) form.append("thumbnail", thumbnail, "thumbnail.webp");

      const response = await fetch(`/api/notes/${noteId}/attachments`, {
        method: "POST",
        body: form
      });
      let payload;
      try { payload = await response.json(); } catch { payload = {}; }
      if (!response.ok) throw new Error(payload.message || payload.error || `Upload failed (HTTP ${response.status})`);
      state.attachments.unshift(payload.attachment);
      renderAttachments();
      setStatus(`Added ${payload.attachment.filename}`);
    } catch (error) {
      setStatus(`Upload error: ${error.message}`);
    }
  }

  if (elements.attachmentFile) elements.attachmentFile.value = "";
  if (label?.querySelector("span")) label.querySelector("span").textContent = originalText;
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
  updateWordCount();
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
  if (!event.key || elements.appShell.hidden || event.altKey) return;
  const key = event.key.toLowerCase();

  // Escape exits focus mode
  if (event.key === "Escape" && elements.appShell?.classList.contains("focus-mode")) {
    exitFocusMode();
    return;
  }

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

function toggleFormatExtra(event) {
  event?.preventDefault();
  const toggle = event?.currentTarget || elements.formatExtraToggle;
  const extra = document.getElementById(toggle?.getAttribute("aria-controls")) || elements.formatExtra;
  if (!toggle || !extra) return;

  const isExpanded = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", isExpanded ? "false" : "true");
  extra.hidden = isExpanded;
}


function bindEvents() {
  elements.authForm.addEventListener("submit", submitAuth);
  elements.logout.addEventListener("click", logout);
  elements.notebookForm?.addEventListener("submit", createNotebookFromForm);

  // Sidebar collapse toggle — persisted to localStorage
  const SIDEBAR_COLLAPSED_KEY = "edge_sidebar_collapsed";
  function applySidebarCollapse(collapsed) {
    elements.appShell?.classList.toggle("sidebar-collapsed", collapsed);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  }
  // Restore on load
  if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") {
    applySidebarCollapse(true);
  }
  // Logo mark in the sidebar toggles collapse (use last/sidebar one, not auth panel one)
  document.querySelector(".sidebar .brand-mark")?.addEventListener("click", () => {
    const isCollapsed = elements.appShell?.classList.contains("sidebar-collapsed");
    applySidebarCollapse(!isCollapsed);
  });

  // Show notebook form when + clicked, hide on Escape
  document.querySelector("[data-action='toggle-notebook-form']")?.addEventListener("click", () => {
    const form = elements.notebookForm;
    if (!form) return;
    form.hidden = !form.hidden;
    if (!form.hidden) elements.notebookName?.focus();
  });

  elements.notebookName?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      elements.notebookForm.hidden = true;
      elements.notebookName.value = "";
    }
  });

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

  elements.insertChecklist?.addEventListener("click", insertChecklistItem);
  elements.formatExtraToggle?.addEventListener("mousedown", (event) => event.preventDefault());
  elements.formatExtraToggle?.addEventListener("click", toggleFormatExtra);
  elements.formatButtons.forEach((button) => {
    // mousedown fires before the editor loses focus, so we save the selection first
    button.addEventListener("mousedown", (event) => {
      captureEditorSelection();
      state.suppressSelectionSave = true;
      event.preventDefault(); // prevent editor losing focus
    });
    button.addEventListener("click", () => {
      applyWysiwygFormat(button.dataset.format);
      requestAnimationFrame(() => {
        state.suppressSelectionSave = false;
      });
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
  elements.focusMode?.addEventListener("click", toggleFocusMode);
  elements.saveNote.addEventListener("click", saveNote);

  elements.attachmentFile?.addEventListener("pointerdown", () => {
    saveSelection();
  });
  elements.attachmentFile?.closest(".inline-attach-btn")?.addEventListener("pointerdown", () => {
    saveSelection();
  });

  // Inline attachment file input — images go inline into editor body (Bear-style),
  // non-image files go to the attachment grid at the bottom.
  elements.attachmentFile?.addEventListener("change", () => {
    const files = Array.from(elements.attachmentFile.files || []);
    uploadAttachmentFiles(files);
  });

  // Mobile floating image button — always visible inside editor, no need to scroll to top
  const mobileFloatImg = document.querySelector("[data-mobile-float-img]");
  mobileFloatImg?.addEventListener("change", () => {
    const files = Array.from(mobileFloatImg.files || []);
    if (files.length) uploadAttachmentFiles(files);
    mobileFloatImg.value = "";
  });

  // Settings panel open/close
  document.querySelector("[data-action='open-settings']")?.addEventListener("click", () => {
    if (elements.settingsPanel) elements.settingsPanel.hidden = false;
  });
  document.querySelector("[data-action='close-settings']")?.addEventListener("click", () => {
    if (elements.settingsPanel) elements.settingsPanel.hidden = true;
  });

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

  elements.title.addEventListener("input", () => {
    saveDraftCache();
    scheduleAutoSave();
  });
  elements.body.addEventListener("input", () => {
    saveDraftCache();
    renderTasks();
    updateWordCount();
    if (state.attachments.length) renderAttachments();
    scheduleAutoSave();
  });
  // Track selection so toolbar knows where to insert formatting.
  elements.body.addEventListener("keyup", saveSelection);
  elements.body.addEventListener("mouseup", saveSelection);
  document.addEventListener("selectionchange", saveSelection);

  elements.body.addEventListener("click", (event) => {
    const table = event.target.closest("table.note-table");
    if (table) {
      showTableControls(table);
    }
  });

  elements.body.addEventListener("focusin", (event) => {
    const table = event.target.closest("table.note-table");
    if (table) {
      showTableControls(table);
    }
  });

  // Table keyboard navigation: Tab/Shift+Tab moves between cells.
  // Tab on the last cell of the last row appends a new row.
  elements.body.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const cell = selectedTableCell();
      if (cell) return;
      const sel = window.getSelection();
      let node = sel?.rangeCount ? sel.getRangeAt(0).startContainer : null;
      if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const item = node?.closest?.("ul.checklist > li");
      const text = item?.querySelector(".checklist-text");
      if (item && text) {
        event.preventDefault();
        const isEmpty = !text.textContent.trim();
        if (isEmpty) {
          const paragraph = document.createElement("p");
          paragraph.innerHTML = "<br>";
          item.closest("ul.checklist")?.after(paragraph);
          item.remove();
          placeCaretInNode(paragraph, false);
        } else {
          const next = document.createElement("li");
          next.className = "task-item";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.setAttribute("data-task-check", "");
          const nextText = document.createElement("span");
          nextText.className = "checklist-text";
          nextText.innerHTML = "<br>";
          next.append(checkbox, nextText);
          item.after(next);
          placeCaretInNode(nextText, false);
        }
        notifyEditorChanged();
        return;
      }
    }

    if (event.key !== "Tab") return;
    const cell = event.target.closest("td, th");
    if (!cell) return;
    const table = cell.closest("table.note-table");
    if (!table) return;
    event.preventDefault();

    const allCells = Array.from(table.querySelectorAll("th, td"));
    const idx = allCells.indexOf(cell);

    if (!event.shiftKey) {
      // Forward
      if (idx < allCells.length - 1) {
        placeCaretInNode(allCells[idx + 1]);
      } else {
        // Last cell — append a new body row
        const colCount = table.querySelector("tr").querySelectorAll("th, td").length;
        const newRow = table.querySelector("tbody").insertRow(-1);
        for (let i = 0; i < colCount; i++) newRow.insertCell(-1).innerHTML = "<br>";
        const firstNew = newRow.cells[0];
        placeCaretInNode(firstNew, false);
        notifyEditorChanged();
      }
    } else {
      // Backward
      if (idx > 0) {
        placeCaretInNode(allCells[idx - 1]);
      }
    }
  });

  function currentTableContext(table, preferredCell = null) {
    const cell = preferredCell || selectedTableCell() || table.querySelector("tbody td, th");
    const row = cell?.closest("tr") || table.querySelector("tbody tr, tr");
    const colIndex = row && cell ? Array.from(row.cells).indexOf(cell) : 0;
    const isHeader = cell?.tagName === "TH";
    return { cell, row, colIndex: Math.max(0, colIndex), isHeader };
  }

  function runTableAction(table, action, preferredCell = null) {
    if (!table?.isConnected) return;
    const { cell, row, colIndex, isHeader } = currentTableContext(table, preferredCell);
    if (!row) return;

    if (action === "add-row-above") {
      const colCount = table.querySelector("tr")?.cells.length || 3;
      row.parentElement.insertBefore(buildRow(colCount, false), row);
    } else if (action === "add-row-below") {
      const colCount = table.querySelector("tr")?.cells.length || 3;
      row.after(buildRow(colCount, false));
    } else if (action === "del-row") {
      if (table.querySelectorAll("tbody tr").length > 1 || isHeader) {
        row.remove();
      } else {
        deleteTable(table);
        return;
      }
    } else if (action === "add-col-left") {
      addColumn(table, colIndex);
    } else if (action === "add-col-right") {
      addColumn(table, colIndex + 1);
    } else if (action === "del-col") {
      deleteColumn(table, colIndex);
    } else if (action === "del-table") {
      deleteTable(table);
      return;
    }

    const nextCell = cell?.isConnected ? cell : table.querySelector("tbody td, th");
    if (nextCell) placeCaretInNode(nextCell, false);
    showTableControls(table);
    notifyEditorChanged();
  }

  function showTableControls(table) {
    if (!table?.isConnected) return;
    document.getElementById("table-controls")?.remove();

    const controls = document.createElement("div");
    controls.id = "table-controls";
    controls.className = "table-controls";
    controls.innerHTML = `
      <span class="table-controls-label">Table</span>
      <button type="button" data-tbl="add-row-above">Row above</button>
      <button type="button" data-tbl="add-row-below">Row below</button>
      <button type="button" data-tbl="del-row">Delete row</button>
      <span class="table-controls-sep"></span>
      <button type="button" data-tbl="add-col-left">Col left</button>
      <button type="button" data-tbl="add-col-right">Col right</button>
      <button type="button" data-tbl="del-col">Delete col</button>
      <span class="table-controls-sep"></span>
      <button type="button" class="table-controls-danger" data-tbl="del-table">Delete table</button>
    `;
    document.body.appendChild(controls);

    const rect = table.getBoundingClientRect();
    const preferredTop = rect.top - controls.offsetHeight - 8;
    const fallbackTop = Math.min(window.innerHeight - controls.offsetHeight - 8, rect.bottom + 8);
    const top = Math.max(8, preferredTop >= 8 ? preferredTop : fallbackTop);
    const left = Math.min(
      window.innerWidth - controls.offsetWidth - 12,
      Math.max(12, rect.left)
    );
    controls.style.top = `${top}px`;
    controls.style.left = `${left}px`;

    controls.addEventListener("mousedown", (event) => event.preventDefault());
    controls.addEventListener("click", (event) => {
      const button = event.target.closest("[data-tbl]");
      if (!button) return;
      runTableAction(table, button.dataset.tbl);
    });
  }

  function hideTableControls() {
    document.getElementById("table-controls")?.remove();
  }

  document.addEventListener("mousedown", (event) => {
    if (event.target.closest("#table-controls") || event.target.closest("table.note-table")) return;
    hideTableControls();
  });

  // Table context menu — right-click any cell for row/column/delete actions.
  elements.body.addEventListener("contextmenu", (event) => {
    const cell = event.target.closest("td, th");
    if (!cell) return;
    const table = cell.closest("table.note-table");
    if (!table) return;

    event.preventDefault();
    document.getElementById("table-ctx-menu")?.remove();

    const menu = document.createElement("div");
    menu.id = "table-ctx-menu";
    menu.className = "table-ctx-menu";
    menu.innerHTML = `
      <button data-tbl="add-row-above">Insert row above</button>
      <button data-tbl="add-row-below">Insert row below</button>
      <button data-tbl="del-row">Delete row</button>
      <div class="table-ctx-sep"></div>
      <button data-tbl="add-col-left">Insert column left</button>
      <button data-tbl="add-col-right">Insert column right</button>
      <button data-tbl="del-col">Delete column</button>
      <div class="table-ctx-sep"></div>
      <button data-tbl="del-table" class="table-ctx-danger">Delete table</button>
    `;

    // Position near cursor
    menu.style.top = `${Math.min(event.clientY + 4, window.innerHeight - 260)}px`;
    menu.style.left = `${Math.min(event.clientX, window.innerWidth - 200)}px`;
    document.body.appendChild(menu);

    function closeMenu() {
      menu.remove();
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    }
    function onOutside(e) { if (!menu.contains(e.target)) closeMenu(); }
    function onKey(e) { if (e.key === "Escape") closeMenu(); }
    setTimeout(() => {
      document.addEventListener("mousedown", onOutside);
      document.addEventListener("keydown", onKey);
    }, 0);

    menu.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tbl]");
      if (!btn) return;
      closeMenu();
      runTableAction(table, btn.dataset.tbl, cell);
    });
  });

  function buildRow(colCount, isHeader = false) {
    const tr = document.createElement("tr");
    for (let i = 0; i < colCount; i++) {
      const cell = document.createElement(isHeader ? "th" : "td");
      cell.innerHTML = "<br>";
      tr.appendChild(cell);
    }
    return tr;
  }

  function addColumn(table, atIndex) {
    table.querySelectorAll("tr").forEach((row) => {
      const isHead = row.closest("thead") !== null;
      const cell = document.createElement(isHead ? "th" : "td");
      cell.innerHTML = "<br>";
      const ref = row.cells[atIndex];
      if (ref) row.insertBefore(cell, ref);
      else row.appendChild(cell);
    });
  }

  function deleteColumn(table, colIndex) {
    const allRows = table.querySelectorAll("tr");
    if (allRows[0]?.cells.length <= 1) { deleteTable(table); return; }
    allRows.forEach((row) => {
      if (row.cells[colIndex]) row.cells[colIndex].remove();
    });
  }

  function deleteTable(table) {
    const next = table.nextElementSibling || table.previousElementSibling;
    table.remove();
    hideTableControls();
    if (next) {
      placeCaretInNode(next, false);
    }
    notifyEditorChanged();
  }

  function toggleChecklistCheckbox(checkbox) {
    const item = checkbox.closest("li");
    const willBeChecked = !checkbox.checked;
    checkbox.checked = willBeChecked;
    checkbox.defaultChecked = willBeChecked;
    if (willBeChecked) {
      checkbox.setAttribute("checked", "");
    } else {
      checkbox.removeAttribute("checked");
    }
    if (item) {
      item.classList.add("task-item");
      item.classList.toggle("complete", willBeChecked);
    }
    notifyEditorChanged();
  }

  function handleChecklistToggleEvent(event) {
    if (event.target.matches("input[data-task-check]")) {
      event.preventDefault();
      event.stopPropagation();
      toggleChecklistCheckbox(event.target);
    }
  }

  // Handle checkbox toggles before the browser/contenteditable layer can
  // rewrite the checked state underneath us. The click fallback covers
  // browsers that still dispatch click after a prevented pointerdown.
  elements.body.addEventListener("pointerdown", handleChecklistToggleEvent, true);
  elements.body.addEventListener("click", handleChecklistToggleEvent, true);

  // Image toolbar — click a note-img to get resize + delete controls
  elements.body.addEventListener("click", (event) => {
    const img = event.target.closest("img.note-img");
    const existing = document.getElementById("img-toolbar");
    if (existing) existing.remove();
    if (!img) return;

    event.preventDefault();

    const toolbar = document.createElement("div");
    toolbar.id = "img-toolbar";
    toolbar.className = "img-toolbar";
    toolbar.innerHTML = `
      <span class="img-toolbar-label">Size:</span>
      <button type="button" data-img-size="25%">S</button>
      <button type="button" data-img-size="50%">M</button>
      <button type="button" data-img-size="75%">L</button>
      <button type="button" data-img-size="100%">Full</button>
      <span class="img-toolbar-sep"></span>
      <button type="button" class="img-toolbar-delete" data-img-delete aria-label="Delete image">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
        Delete
      </button>
    `;

    document.body.appendChild(toolbar);

    // Position above the image
    const rect = img.getBoundingClientRect();
    const tbRect = toolbar.getBoundingClientRect();
    const top = Math.max(8, rect.top - tbRect.height - 8) + window.scrollY;
    const left = Math.min(
      Math.max(8, rect.left + window.scrollX),
      window.innerWidth - tbRect.width - 8
    );
    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;

    // Mark current size
    const currentWidth = img.getAttribute("width") || "100%";
    toolbar.querySelectorAll("[data-img-size]").forEach((btn) => {
      if (btn.dataset.imgSize === currentWidth) btn.classList.add("active");
    });

    function closeToolbar() {
      toolbar.remove();
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    }

    toolbar.addEventListener("click", (e) => {
      const sizeBtn = e.target.closest("[data-img-size]");
      const deleteBtn = e.target.closest("[data-img-delete]");

      if (sizeBtn) {
        img.setAttribute("width", sizeBtn.dataset.imgSize);
        img.style.width = sizeBtn.dataset.imgSize;
        toolbar.querySelectorAll("[data-img-size]").forEach((b) => b.classList.remove("active"));
        sizeBtn.classList.add("active");
        saveDraftCache();
        saveNote();
        return;
      }

      if (deleteBtn) {
        // Remove the img (and its wrapping <p> if it's the only child)
        const parent = img.parentElement;
        img.remove();
        if (parent && parent !== elements.body && !parent.textContent.trim() && !parent.querySelector("img")) {
          parent.remove();
        }
        closeToolbar();
        saveDraftCache();
        saveNote();
        return;
      }
    });

    function onOutside(e) {
      if (!toolbar.contains(e.target) && e.target !== img) closeToolbar();
    }
    function onKey(e) { if (e.key === "Escape") closeToolbar(); }
    setTimeout(() => {
      document.addEventListener("mousedown", onOutside);
      document.addEventListener("keydown", onKey);
    }, 0);
  });

  // Paste handler — intercept image data from clipboard
  elements.body.addEventListener("paste", (event) => {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return; // let default paste handle text
    event.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    insertImageFileIntoEditor(file);
  });

  // Drag-and-drop files into the editor. Images embed inline; other files attach.
  elements.body.addEventListener("dragover", (event) => {
    const hasFiles = Array.from(event.dataTransfer?.items || []).some((i) => i.kind === "file")
      || Boolean(event.dataTransfer?.files?.length);
    if (hasFiles) event.preventDefault();
  });

  elements.body.addEventListener("drop", (event) => {
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length) return;
    event.preventDefault();
    uploadAttachmentFiles(files);
  });

  // Drag-and-drop onto the inline attach bar — any file type
  const attachBar = document.querySelector(".inline-attach-bar");
  if (attachBar) {
    attachBar.addEventListener("dragover", (event) => {
      if (event.dataTransfer?.items?.length) {
        event.preventDefault();
        attachBar.classList.add("drag-over");
      }
    });
    attachBar.addEventListener("dragleave", () => attachBar.classList.remove("drag-over"));
    attachBar.addEventListener("drop", (event) => {
      event.preventDefault();
      attachBar.classList.remove("drag-over");
      const files = Array.from(event.dataTransfer?.files || []);
      uploadAttachmentFiles(files);
    });
  }

  // (Toolbar is now a static sticky bar — no show/hide listeners needed.)
  elements.notebook.addEventListener("change", () => {
    saveDraftCache();
    scheduleAutoSave();
  });
  elements.tags.addEventListener("input", () => {
    saveDraftCache();
    scheduleAutoSave();
  });

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

  // Shared notebook click handler (sidebar + mobile modal)
  function handleNotebookListClick(event) {
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
    const moveBtn = event.target.closest("[data-notebook-move]");
    if (moveBtn) {
      moveNotebook(Number(moveBtn.dataset.notebookMove));
      return;
    }
    const iconBtn = event.target.closest("[data-notebook-icon]");
    if (iconBtn) {
      setNotebookIcon(Number(iconBtn.dataset.notebookIcon));
      return;
    }
    const toggleBtn = event.target.closest("[data-notebook-toggle]");
    if (toggleBtn) {
      const id = Number(toggleBtn.dataset.notebookToggle);
      const row = toggleBtn.closest(".notebook-row");
      if (collapsedNotebooks.has(id)) {
        collapsedNotebooks.delete(id);
        row?.classList.add("expanded");
        row?.querySelector(".notebook-children")?.classList.remove("collapsed");
      } else {
        collapsedNotebooks.add(id);
        row?.classList.remove("expanded");
        row?.querySelector(".notebook-children")?.classList.add("collapsed");
      }
      saveCollapsedNotebooks();
      return;
    }
    const link = event.target.closest("[data-notebook-filter]");
    if (!link) return;
    event.preventDefault();
    state.notebookFilter = Number(link.dataset.notebookFilter);
    state.tagFilter = null;
    state.filter = "all";
    // Close mobile modal if open
    closeNotebooksModal();
    loadNotes();
    setMobilePanel("list");
  }

  elements.notebooksList.addEventListener("click", handleNotebookListClick);

  // Desktop notebook manage panel
  function openManagePanel() {
    if (!elements.nbManagePanel) return;
    elements.nbManagePanel.hidden = false;
    const tree = renderNotebookTree(state.notebooks);
    if (elements.nbManageList) {
      elements.nbManageList.innerHTML = tree || '<p style="padding:8px;color:var(--sb-ink-3);font-size:.8rem">No notebooks yet.</p>';
    }
    const parentOptions = buildNotebookParentOptions();
    if (elements.nbManageParent) elements.nbManageParent.innerHTML = parentOptions;
    elements.nbManageName?.focus();
  }

  function closeManagePanel() {
    if (!elements.nbManagePanel) return;
    elements.nbManagePanel.hidden = true;
  }

  document.querySelector("[data-action='open-manage-notebooks']")?.addEventListener("click", openManagePanel);
  document.querySelector("[data-action='close-manage-notebooks']")?.addEventListener("click", closeManagePanel);

  elements.nbManageList?.addEventListener("click", handleNotebookListClick);

  elements.nbManageForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = elements.nbManageName?.value.trim();
    if (!name) return;
    const parentId = elements.nbManageParent?.value ? Number(elements.nbManageParent.value) : null;
    try {
      await createNotebookApi({ name, parentId });
      if (elements.nbManageName) elements.nbManageName.value = "";
      if (elements.nbManageList) {
        elements.nbManageList.innerHTML = renderNotebookTree(state.notebooks) || '<p style="padding:8px;color:var(--sb-ink-3);font-size:.8rem">No notebooks yet.</p>';
      }
      const parentOptions = buildNotebookParentOptions();
      if (elements.nbManageParent) elements.nbManageParent.innerHTML = parentOptions;
      setStatus(`Notebook "${name}" ready`);
    } catch (error) {
      setStatus(error.message);
    }
  });

  // Mobile notebooks modal
  function openNotebooksModal() {
    if (!elements.mobileModalOverlay) return;
    elements.mobileModalOverlay.hidden = false;
    document.body.style.overflow = "hidden";
    // Refresh the list
    if (elements.mobileNotebooksList) {
      elements.mobileNotebooksList.innerHTML = renderMobileNotebookList(state.notebooks) || '<p class="home-empty">No notebooks yet.</p>';
    }
  }

  function closeNotebooksModal() {
    if (!elements.mobileModalOverlay) return;
    elements.mobileModalOverlay.hidden = true;
    document.body.style.overflow = "";
  }

  // "Notebooks" tab and "Manage" button both open the modal
  document.querySelectorAll("[data-action='open-notebooks-modal'], [data-action='manage-notebooks']").forEach((btn) => {
    btn.addEventListener("click", openNotebooksModal);
  });

  document.querySelector("[data-action='close-notebooks-modal']")?.addEventListener("click", closeNotebooksModal);

  elements.mobileModalOverlay?.addEventListener("click", (event) => {
    if (event.target === elements.mobileModalOverlay) closeNotebooksModal();
  });

  elements.mobileNotebooksList?.addEventListener("click", handleNotebookListClick);

  elements.mobileNotebookForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = elements.mobileNotebookName?.value.trim();
    if (!name) return;
    const parentId = elements.mobileNotebookParent?.value ? Number(elements.mobileNotebookParent.value) : null;
    try {
      await createNotebookApi({ name, parentId });
      if (elements.mobileNotebookName) elements.mobileNotebookName.value = "";
      if (elements.mobileNotebookParent) elements.mobileNotebookParent.value = "";
      // Refresh modal list
      if (elements.mobileNotebooksList) {
        elements.mobileNotebooksList.innerHTML = renderMobileNotebookList(state.notebooks) || '<p class="home-empty">No notebooks yet.</p>';
      }
      setStatus(`Notebook "${name}" ready`);
    } catch (error) {
      setStatus(error.message);
    }
  });

  // Scratchpad — persist to localStorage
  if (elements.scratchpad) {
    elements.scratchpad.addEventListener("input", () => {
      localStorage.setItem("edge_scratchpad", elements.scratchpad.value);
    });
  }

  // Convert scratchpad to note
  document.querySelector("[data-action='scratchpad-to-note']")?.addEventListener("click", () => {
    const text = elements.scratchpad?.value.trim();
    if (!text) return;
    createNewNote();
    // Give the editor a moment to initialise, then paste the text
    setTimeout(() => {
      if (elements.body) {
        elements.body.innerText = text;
        updateWordCount();
        elements.body.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (elements.scratchpad) {
        elements.scratchpad.value = "";
        localStorage.removeItem("edge_scratchpad");
      }
      setMobilePanel("editor");
    }, 80);
  });

  // Mobile format bar — show when editor is focused, hide when blurred
  if (elements.mobileFormatBar && elements.body) {
    elements.body.addEventListener("focus", () => {
      if (window.innerWidth <= 660) elements.mobileFormatBar.hidden = false;
    });
    elements.body.addEventListener("blur", () => {
      // Small delay so toolbar button taps register before hiding
      setTimeout(() => { elements.mobileFormatBar.hidden = true; }, 150);
    });
    // Wire format buttons on the mobile bar to the same handler
    elements.mobileFormatBar.querySelectorAll("[data-format]").forEach((button) => {
      button.addEventListener("mousedown", (event) => {
        captureEditorSelection();
        state.suppressSelectionSave = true;
        event.preventDefault();
      });
      button.addEventListener("click", () => {
        applyWysiwygFormat(button.dataset.format);
        requestAnimationFrame(() => {
          state.suppressSelectionSave = false;
        });
      });
    });
  }

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
    const notebookCard = event.target.closest("[data-notebook-filter]");
    if (notebookCard) {
      state.notebookFilter = Number(notebookCard.dataset.notebookFilter);
      state.tagFilter = null;
      state.filter = "all";
      loadNotes();
      return;
    }
    const card = event.target.closest("[data-note-id]");
    if (!card) return;
    const note = state.notes.find((item) => item.id === Number(card.dataset.noteId));
    if (note) selectNote(note);
  });

  elements.list.addEventListener("keydown", (event) => {
    const notebookCard = event.target.closest("[data-notebook-filter]");
    if (notebookCard && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      state.notebookFilter = Number(notebookCard.dataset.notebookFilter);
      state.tagFilter = null;
      state.filter = "all";
      loadNotes();
      return;
    }
    const card = event.target.closest("[data-note-id]");
    if (!card) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const note = state.notes.find((item) => item.id === Number(card.dataset.noteId));
      if (note) selectNote(note);
    }
  });

  elements.attachmentList.addEventListener("click", (event) => {
    const embed = event.target.closest("[data-attachment-embed]");
    const replace = event.target.closest("[data-attachment-replace]");
    const remove = event.target.closest("[data-attachment-delete]");
    if (embed) {
      const attachment = state.attachments.find((a) => a.id === Number(embed.dataset.attachmentEmbed));
      if (attachment) {
        insertImageUrl(attachment.downloadUrl, attachment.filename);
        setMobilePanel("editor");
      }
      return;
    }
    if (replace) {
      replaceSelectedAttachment(Number(replace.dataset.attachmentReplace));
      return;
    }
    if (remove) {
      deleteSelectedAttachment(Number(remove.dataset.attachmentDelete));
    }
  });

  window.addEventListener("online", schedulePendingSync);
  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsyncedWork()) return;
    event.preventDefault();
    event.returnValue = "";
  });
  window.addEventListener("keydown", handleGlobalShortcuts);

  // Auto-sync: reload notes every 60 seconds when the tab is visible
  let autoSyncInterval = null;
  function startAutoSync() {
    if (autoSyncInterval) return;
    autoSyncInterval = window.setInterval(async () => {
      if (document.hidden) return;
      await flushPendingChanges();
      await loadNotes();
      if (state.filter === "home") renderHomeView();
    }, 60_000);
  }
  function stopAutoSync() {
    window.clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
  // Also sync immediately when the tab becomes visible again
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      flushPendingChanges();
      loadNotes().then(() => {
        if (state.filter === "home") renderHomeView();
      });
    }
  });
  startAutoSync();
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
