const cacheKeys = {
  draft: "edge_note_draft_v1",
  notes: "edge_note_notes_v1",
  collections: "edge_note_collections_v2",
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
  // Stable id for a brand-new note that has no server id yet. Every save
  // attempt and queued offline change for that draft reuses it, so the
  // server can recognise retries instead of creating duplicate notes.
  draftClientId: null,
  focusModeReturnState: null,
  autoSaveTimer: null,
  lastAutoSaveSignature: "",
  pendingSave: false,
  saveAgainRequested: false,
  editorRedoStack: [],
  editorUndoStack: [],
  forceEditorOpen: false,
  pendingInlineFormats: new Set(),
  suppressSelectionSave: false,
  tableSort: { col: "updatedAt", dir: "desc" },
  tableShowArchived: false,
  tableSelectedIds: new Set()
};

let pendingSyncTimer = null;
let allNotesCache = []; // full note list for @mention search, regardless of active filter
const autoSaveDelayMs = 2500;
const internalNavigationFlag = "edge_note_internal_navigation_v1";

function isMobileViewport() {
  return window.matchMedia?.("(max-width: 660px)")?.matches || window.innerWidth <= 660;
}

function requestedNoteIdFromUrl() {
  const rawId = new URLSearchParams(window.location.search).get("note");
  const noteId = Number(rawId);
  return Number.isInteger(noteId) && noteId > 0 ? noteId : null;
}

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
  importMarkdown: document.querySelector("[data-action='import-markdown']"),
  importCsv: document.querySelector("[data-action='import-csv']"),
  repairCsv: document.querySelector("[data-action='repair-csv']"),
  markdownImport: document.querySelector("[data-markdown-import]"),
  csvImport: document.querySelector("[data-csv-import]"),
  csvRepair: document.querySelector("[data-csv-repair]"),
  importStatus: document.querySelector("[data-import-status]"),
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
  saveNoteDot: document.querySelector("[data-save-dot]"),
  saveNoteLabel: document.querySelector("[data-save-btn-label]"),
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
  formatButtons: document.querySelectorAll("[data-floating-toolbar] [data-format]"),
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
  // Separate block elements with a space; textContent alone glues them
  // together ("Priorities" + "Close the..." -> "PrioritiesClose the...").
  tmp.innerHTML = String(html || "").replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr|td|th)>|<br\s*\/?>/gi, "$& ");
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

function setSaveButtonState(status = "idle") {
  if (!elements.saveNote) return;
  let label = elements.saveNoteLabel || elements.saveNote.querySelector("[data-save-btn-label]");
  let dot = elements.saveNoteDot || elements.saveNote.querySelector("[data-save-dot]");

  if (!label || !dot) {
    elements.saveNote.textContent = "";
    label = document.createElement("span");
    label.dataset.saveBtnLabel = "";
    dot = document.createElement("span");
    dot.className = "save-btn-dot";
    dot.dataset.saveDot = "";
    dot.setAttribute("aria-hidden", "true");
    elements.saveNote.append(label, dot);
    elements.saveNoteLabel = label;
    elements.saveNoteDot = dot;
  }

  dot.classList.remove("saved", "unsaved", "saving", "error");
  dot.classList.add(status === "idle" ? "saved" : status);
  label.textContent = status === "saving" ? "Saving" : "Save";
  elements.saveNote.dataset.saveState = status;
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

function uniqueTags(tags) {
  return (tags || [])
    .map((tag) => String(tag || "").replace(/^#/, "").trim())
    .filter(Boolean)
    .filter((tag, index, all) => all.findIndex((item) => item.toLowerCase() === tag.toLowerCase()) === index);
}

function isSafeUrl(value) {
  try {
    const url = new URL(value, window.location.origin);
    return ["http:", "https:", "mailto:", "note:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function isNoteLink(href) {
  return typeof href === "string" && href.startsWith("note:");
}

function noteLinkId(href) {
  return Number(href.replace("note:", "")) || null;
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
    span: new Set(["checklist-text", "note-link"]),
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
    const safeNoteLink = tag === "span" ? element.getAttribute("data-note-link") : null;
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

    if (safeNoteLink) {
      element.setAttribute("data-note-link", safeNoteLink);
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
  return sanitizeHtml(elements.body.innerHTML || "");
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
    draftClientId: state.selectedId ? null : ensureDraftClientId(),
    cachedAt: new Date().toISOString()
  });
  setCacheStatus("Draft cached", "Saved in this browser");
  if (!state.pendingSave) setSaveButtonState("unsaved");
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

function markInternalNavigation() {
  sessionStorage.setItem(internalNavigationFlag, "1");
}

function writePendingChanges(changes) {
  writeCache(cacheKeys.pendingChanges, changes);
  setCacheStatus(changes.length ? "Sync queued" : "Synced locally", changes.length ? `${changes.length} pending changes` : `${state.notes.length} notes cached`);
}

// The note title is a <textarea> so long titles wrap instead of being cut
// off (notably on phones). It grows to fit its text.
function autosizeTitle() {
  const title = elements.title;
  if (!title || title.tagName !== "TEXTAREA") return;
  if (!title.offsetParent) return; // hidden panel: size it when it appears
  title.style.height = "auto";
  title.style.height = `${title.scrollHeight}px`;
}

function watchTitleSize() {
  const title = elements.title;
  if (!title || title.tagName !== "TEXTAREA") return;
  // The app sets title.value from code in several places (open note, new
  // note, restore draft, save), which fires no input event. Resize on every
  // programmatic set by wrapping the element's own value setter.
  const native = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  Object.defineProperty(title, "value", {
    configurable: true,
    get() { return native.get.call(this); },
    set(next) { native.set.call(this, next); autosizeTitle(); }
  });
  // Re-measure when the editor becomes visible or changes width.
  if ("ResizeObserver" in window && title.parentElement) {
    new ResizeObserver(() => autosizeTitle()).observe(title.parentElement);
  }
  autosizeTitle();
}

function newClientId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ensureDraftClientId() {
  if (!state.draftClientId) state.draftClientId = newClientId();
  return state.draftClientId;
}

// Queue an offline change, coalescing with an earlier queued change for the
// same note. Autosave fires every 2.5s, so appending blindly queued dozens of
// entries while offline: a new note became N duplicate notes (each entry had
// its own clientId), and an existing note produced N-1 false conflicts (each
// entry carried the same baseSyncVersion). Coalescing keeps the first entry's
// clientId and baseSyncVersion and replaces its data with the latest draft.
function queuePendingChange(change) {
  const changes = pendingChanges();
  const index = changes.findIndex((queued) => queued.entityType === change.entityType && (
    (change.clientId && queued.clientId === change.clientId)
    || (change.action === "update" && queued.action === "update" && change.entityId && queued.entityId === change.entityId)
  ));

  if (index >= 0) {
    changes[index] = {
      ...changes[index],
      data: change.data,
      queuedAt: new Date().toISOString()
    };
  } else {
    changes.push({
      ...change,
      clientId: change.clientId || newClientId(),
      queuedAt: new Date().toISOString()
    });
  }
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
  state.draftClientId = state.selectedId ? null : (draft.draftClientId || null);
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
  state.draftClientId = null;
  if (note) setMobilePanel("editor");
  setSaveButtonState(note?.id ? "idle" : "unsaved");
  elements.notebook.value = note?.notebookId || "";
  elements.tags.value = (note?.tags || []).join(", ");
  elements.title.value = note?.title || "Untitled note";
  const bodyHtml = note?.bodyFormat === "markdown"
    ? markdownToHtml(note.body)
    : (note?.body || "");
  setEditorHtml(bodyHtml);
  updateWordCount();
  updateToolbarState();
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

async function openNoteById(noteId) {
  const id = Number(noteId);
  if (!Number.isInteger(id) || id <= 0) return false;

  state.filter = "all";
  state.notebookFilter = null;
  state.tagFilter = null;
  if (elements.search) elements.search.value = "";
  updateNavigationState();

  let note = state.notes.find((item) => item.id === id)
    || allNotesCache.find((item) => item.id === id);

  if (!note) {
    const payload = await requestJson(`/api/notes/${id}`);
    note = payload.note;
    if (note && !state.notes.some((item) => item.id === id)) {
      state.notes = [note, ...state.notes];
    }
  }

  if (!note) return false;
  state.forceEditorOpen = true;
  state.tableShowArchived = false;
  state.filter = "all";
  state.notebookFilter = note.notebookId || null;
  state.tagFilter = null;
  elements.appShell?.classList.remove("table-mode");
  elements.list?.classList.remove("notes-table-view");
  updateNavigationState();
  selectNote(note);
  setMobilePanel("editor");
  return true;
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
  const allowedPanels = new Set(["home", "list", "editor", "graph", "notebooks", "tools"]);
  state.mobilePanel = allowedPanels.has(panel) ? panel : "list";
  if (isMobileViewport()) {
    elements.appShell?.classList.remove("table-mode");
    elements.list?.classList.remove("notes-table-view");
  }
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
function updateFloatingToolbar() { /* no-op — toolbar is always visible */ }

function activeToolbarRange() {
  return selectionIsInEditor(savedSelection)
    ? savedSelection.cloneRange()
    : cloneEditorSelection();
}

function focusEditorForToolbar(range = activeToolbarRange()) {
  elements.body.focus({ preventScroll: true });
  if (selectionIsInEditor(range)) {
    restoreEditorSelection(range);
    return range;
  }
  restoreSelection();
  return selectionIsInEditor(savedSelection) ? savedSelection.cloneRange() : null;
}

function finishToolbarChange(beforeHtml) {
  if (editorSnapshot() !== beforeHtml) {
    pushEditorUndoSnapshot(beforeHtml);
    notifyEditorChanged();
  } else {
    updateWordCount();
  }
  captureEditorSelection();
  updateToolbarState();
  requestAnimationFrame(updateToolbarState);
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

const inlineFormatTags = {
  bold: "strong",
  italic: "em",
  underline: "u",
  strikethrough: "s",
  superscript: "sup",
  subscript: "sub",
  code: "code"
};

const nativeInlineCommands = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strikethrough: "strikeThrough",
  superscript: "superscript",
  subscript: "subscript"
};

function clearNativeInlineCommands() {
  Object.values(nativeInlineCommands).forEach((command) => {
    if (commandState(command)) document.execCommand(command, false, null);
  });
}

function clearPendingInlineFormats() {
  state.pendingInlineFormats.clear();
  clearNativeInlineCommands();
}

function closestInlineFormatNode(format, range = activeToolbarRange()) {
  const tag = inlineFormatTags[format];
  if (!tag || !range) return null;
  const node = range.startContainer?.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer?.parentElement;
  return node?.closest?.(tag) || null;
}

function wrapNodeWithPendingFormats(node) {
  let wrapped = node;
  [...state.pendingInlineFormats].forEach((format) => {
    const tag = inlineFormatTags[format];
    if (!tag) return;
    const element = document.createElement(tag);
    element.appendChild(wrapped);
    wrapped = element;
  });
  return wrapped;
}

function placeCaretAfterNode(node) {
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  restoreEditorSelection(range);
}

function previousInsertionSibling(range) {
  if (!range?.collapsed) return null;
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    return range.startOffset === 0
      ? range.startContainer.previousSibling
      : null;
  }
  return range.startContainer.childNodes[range.startOffset - 1] || null;
}

function appendToPreviousPendingRun(range, text) {
  if (state.pendingInlineFormats.size !== 1) return false;
  const format = [...state.pendingInlineFormats][0];
  const tag = inlineFormatTags[format];
  const previous = previousInsertionSibling(range);
  if (!tag || previous?.nodeType !== Node.ELEMENT_NODE || previous.tagName.toLowerCase() !== tag) {
    return false;
  }

  previous.appendChild(document.createTextNode(text));
  placeCaretAfterNode(previous);
  notifyEditorChanged();
  updateToolbarState();
  return true;
}

function codeNodeNearRange(range = activeToolbarRange()) {
  if (!range) return null;
  const node = range.startContainer?.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer?.parentElement;
  const currentCode = node?.closest?.("code");
  if (currentCode) return currentCode;
  const previous = previousInsertionSibling(range);
  return previous?.nodeType === Node.ELEMENT_NODE && previous.tagName.toLowerCase() === "code"
    ? previous
    : null;
}

function insertParagraphAfterInlineNode(node) {
  if (!node) return false;
  let block = node;
  while (block.parentElement && block.parentElement !== elements.body) {
    block = block.parentElement;
  }
  if (!block || block === elements.body || block.parentElement !== elements.body) return false;

  const paragraph = document.createElement("p");
  paragraph.innerHTML = "<br>";
  block.after(paragraph);
  placeCaretInNode(paragraph, false);
  notifyEditorChanged();
  updateToolbarState();
  return true;
}

function wrapSelectionWithFormat(format, range = activeToolbarRange()) {
  const tag = inlineFormatTags[format];
  if (!tag || !selectionIsInEditor(range) || range.collapsed) return false;

  const existing = closestInlineFormatNode(format, range);
  if (existing && range.intersectsNode(existing)) {
    const nextRange = document.createRange();
    nextRange.selectNodeContents(existing);
    existing.replaceWith(...Array.from(existing.childNodes));
    restoreEditorSelection(nextRange);
    return true;
  }

  const element = document.createElement(tag);
  element.appendChild(range.extractContents());
  range.insertNode(element);
  const nextRange = document.createRange();
  nextRange.selectNodeContents(element);
  restoreEditorSelection(nextRange);
  return true;
}

function togglePendingInlineFormat(format) {
  if (!inlineFormatTags[format]) return false;
  if (state.pendingInlineFormats.has(format)) {
    state.pendingInlineFormats.delete(format);
  } else {
    state.pendingInlineFormats.add(format);
  }
  clearNativeInlineCommands();
  updateToolbarState();
  return true;
}

function insertPendingFormattedText(text) {
  if (!state.pendingInlineFormats.size || !text) return false;
  const range = focusEditorForToolbar();
  if (!selectionIsInEditor(range)) return false;

  if (appendToPreviousPendingRun(range, text)) return true;

  range.deleteContents();
  const node = wrapNodeWithPendingFormats(document.createTextNode(text));
  range.insertNode(node);
  placeCaretAfterNode(node);
  notifyEditorChanged();
  updateToolbarState();
  return true;
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

function replaceElementTag(element, tagName) {
  if (!element || element.tagName.toLowerCase() === tagName) return element;
  const replacement = document.createElement(tagName);
  replacement.innerHTML = element.innerHTML;
  replacement.className = element.className;
  replacement.setAttribute("style", element.getAttribute("style") || "");
  element.replaceWith(replacement);
  return replacement;
}

function normalizeBlockFromRange(range = activeToolbarRange()) {
  let block = selectedEditorBlocks(range)[0] || null;
  if (block) return block;

  if (elements.body.childNodes.length === 1 && elements.body.firstChild?.nodeType === Node.TEXT_NODE) {
    const paragraph = document.createElement("p");
    paragraph.textContent = elements.body.firstChild.nodeValue;
    elements.body.replaceChildren(paragraph);
    placeCaretInNode(paragraph, true);
    return paragraph;
  }

  return null;
}

function toggleHeadingBlock(range = activeToolbarRange()) {
  const block = normalizeBlockFromRange(range);
  if (!block) return false;
  const bookmark = selectionBookmark(activeToolbarRange());
  const nextTag = /^H[2-4]$/.test(block.tagName) ? "p" : "h2";
  replaceElementTag(block, nextTag);
  if (bookmark) restoreSelectionBookmark(bookmark);
  return true;
}

function toggleQuoteBlock(range = activeToolbarRange()) {
  const block = normalizeBlockFromRange(range);
  if (!block) return false;
  const bookmark = selectionBookmark(activeToolbarRange());
  const nextTag = block.tagName === "BLOCKQUOTE" ? "p" : "blockquote";
  replaceElementTag(block, nextTag);
  if (bookmark) restoreSelectionBookmark(bookmark);
  return true;
}

function unwrapListItem(list) {
  const items = Array.from(list.children).filter((child) => child.tagName === "LI");
  const paragraphs = items.map((item) => {
    const paragraph = document.createElement("p");
    paragraph.innerHTML = item.innerHTML || "<br>";
    return paragraph;
  });
  list.replaceWith(...paragraphs);
  return paragraphs[0] || null;
}

function toggleListBlock(type, range = activeToolbarRange()) {
  const block = normalizeBlockFromRange(range);
  if (!block) return false;
  const bookmark = selectionBookmark(activeToolbarRange());
  const listTag = type === "ordered" ? "ol" : "ul";
  const list = block.closest?.("ul, ol");

  if (list && list.tagName.toLowerCase() === listTag && !list.classList.contains("checklist")) {
    unwrapListItem(list);
    if (bookmark) restoreSelectionBookmark(bookmark);
    return true;
  }

  if (list && !list.classList.contains("checklist")) {
    const replacement = document.createElement(listTag);
    replacement.innerHTML = list.innerHTML;
    list.replaceWith(replacement);
    if (bookmark) restoreSelectionBookmark(bookmark);
    return true;
  }

  const item = document.createElement("li");
  item.innerHTML = block.innerHTML || "<br>";
  const nextList = document.createElement(listTag);
  nextList.appendChild(item);
  block.replaceWith(nextList);
  placeCaretInNode(item, true);
  return true;
}

function applyBlockAlignment(alignment, currentSelection = activeToolbarRange()) {
  if (!currentSelection) return false;
  const bookmark = selectionBookmark(currentSelection);

  const blocks = selectedEditorBlocks(currentSelection);
  if (!blocks.length) {
    const command = {
      left: "justifyLeft",
      center: "justifyCenter",
      right: "justifyRight"
    }[alignment];
    if (command) {
      document.execCommand(command, false, null);
      return true;
    }
    return false;
  }

  blocks.forEach((block) => {
    block.style.textAlign = alignment;
  });
  restoreSelectionBookmark(bookmark);
  return true;
}

function applyBlockIndent(direction, currentSelection = activeToolbarRange()) {
  if (!currentSelection) return false;
  const bookmark = selectionBookmark(currentSelection);

  const blocks = selectedEditorBlocks(currentSelection);
  if (!blocks.length) {
    document.execCommand(direction === "in" ? "indent" : "outdent", false, null);
    return true;
  }

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
  const beforeHtml = editorSnapshot();
  const range = focusEditorForToolbar();

  if (kind === "block") {
    clearPendingInlineFormats();
    const block = normalizeBlockFromRange(range);
    if (block) replaceElementTag(block, value || "p");
    finishToolbarChange(beforeHtml);
    return;
  }

  if (kind === "font" && toolbarFonts[value]) {
    applyInlineStyle({ fontFamily: toolbarFonts[value] });
    updateToolbarState();
    return;
  }

  if (kind === "size" && sanitizeCssFontSize(value)) {
    applyInlineStyle({ fontSize: value });
    updateToolbarState();
  }

  if (!range) updateToolbarState();
}

function applyToolbarColor(property, value) {
  const color = sanitizeCssColor(value);
  if (!color || !["color", "backgroundColor"].includes(property)) return;
  applyInlineStyle({ [property]: color });
  updateToolbarState();
}

function anchorBlock() {
  const sel = window.getSelection();
  if (!sel?.anchorNode) return null;
  return sel.anchorNode.nodeType === Node.ELEMENT_NODE
    ? sel.anchorNode
    : sel.anchorNode.parentElement;
}

function commandState(command) {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

function updateToolbarState() {
  const range = cloneEditorSelection() || (selectionIsInEditor(savedSelection) ? savedSelection : null);
  const node = range?.startContainer?.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range?.startContainer?.parentElement;
  const block = node?.closest?.("h2, h3, h4, blockquote, li, p, div, td, th");
  const list = node?.closest?.("ul, ol");
  const textAlign = block?.style?.textAlign || "";

  const pressed = {
    bold: state.pendingInlineFormats.has("bold") || Boolean(node?.closest?.("strong, b")) || commandState("bold"),
    italic: state.pendingInlineFormats.has("italic") || Boolean(node?.closest?.("em, i")) || commandState("italic"),
    underline: state.pendingInlineFormats.has("underline") || Boolean(node?.closest?.("u")) || commandState("underline"),
    strikethrough: state.pendingInlineFormats.has("strikethrough") || Boolean(node?.closest?.("s, strike")) || commandState("strikeThrough"),
    superscript: state.pendingInlineFormats.has("superscript") || Boolean(node?.closest?.("sup")) || commandState("superscript"),
    subscript: state.pendingInlineFormats.has("subscript") || Boolean(node?.closest?.("sub")) || commandState("subscript"),
    heading: Boolean(block && /^H[2-4]$/.test(block.tagName)),
    quote: block?.tagName === "BLOCKQUOTE",
    bullet: list?.tagName === "UL" && !list.classList.contains("checklist"),
    ordered: list?.tagName === "OL",
    checklist: Boolean(node?.closest?.("ul.checklist")),
    code: state.pendingInlineFormats.has("code") || Boolean(node?.closest?.("code")),
    "align-left": Boolean(block) && (!textAlign || textAlign === "left"),
    "align-center": textAlign === "center",
    "align-right": textAlign === "right"
  };

  elements.formatButtons.forEach((button) => {
    const value = button.dataset.format;
    const isPressed = Boolean(pressed[value]);
    button.classList.toggle("active", isPressed);
    if (Object.prototype.hasOwnProperty.call(pressed, value)) {
      button.setAttribute("aria-pressed", isPressed ? "true" : "false");
    } else {
      button.removeAttribute("aria-pressed");
    }
  });

  elements.mobileFormatBar?.querySelectorAll("[data-format]").forEach((button) => {
    const value = button.dataset.format;
    const isPressed = Boolean(pressed[value]);
    button.classList.toggle("active", isPressed);
    if (Object.prototype.hasOwnProperty.call(pressed, value)) {
      button.setAttribute("aria-pressed", isPressed ? "true" : "false");
    } else {
      button.removeAttribute("aria-pressed");
    }
  });

  elements.formatSelects.forEach((select) => {
    if (select.dataset.formatSelect !== "block") return;
    if (block?.tagName === "BLOCKQUOTE") select.value = "blockquote";
    else if (block && ["H2", "H3"].includes(block.tagName)) select.value = block.tagName.toLowerCase();
    else select.value = "p";
  });
}

function applyWysiwygFormat(format) {
  if (format === "undo" || format === "redo") {
    if (format === "undo") {
      undoEditorChange();
    } else {
      redoEditorChange();
    }
    updateToolbarState();
    return;
  }

  const beforeHtml = editorSnapshot();
  const range = activeToolbarRange();
  const inlineFormat = inlineFormatTags[format];

  if (inlineFormat) {
    focusEditorForToolbar(range);
    if (range?.collapsed) {
      togglePendingInlineFormat(format);
      return;
    }
    clearPendingInlineFormats();
    wrapSelectionWithFormat(format, range);
    finishToolbarChange(beforeHtml);
    return;
  }

  if (format === "checklist") {
    clearPendingInlineFormats();
    insertChecklistItem();
    finishToolbarChange(beforeHtml);
    return;
  }

  focusEditorForToolbar(range);
  clearPendingInlineFormats();

  if (format === "heading") { toggleHeadingBlock(range); }
  else if (format === "bullet") { toggleListBlock("bullet", range); }
  else if (format === "ordered") { toggleListBlock("ordered", range); }
  else if (format === "quote") { toggleQuoteBlock(range); }
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
  else if (format === "align-left") { applyBlockAlignment("left", range); }
  else if (format === "align-center") { applyBlockAlignment("center", range); }
  else if (format === "align-right") { applyBlockAlignment("right", range); }
  else if (format === "indent") { applyBlockIndent("in", range); }
  else if (format === "outdent") { applyBlockIndent("out", range); }
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

  finishToolbarChange(beforeHtml);
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
const collapsedNotebooks = new Set(
  JSON.parse(localStorage.getItem("edge_collapsed_notebooks") || "[]")
);

function saveCollapsedNotebooks() {
  localStorage.setItem("edge_collapsed_notebooks", JSON.stringify([...collapsedNotebooks]));
}

// Simple mobile notebook list — name, count, icon picker, delete.
function renderMobileNotebookList(notebooks, parentId = null, depth = 0) {
  const children = notebooks.filter((nb) => (nb.parentId || null) === parentId);
  if (!children.length) return "";
  return children.map((nb) => {
    const indent = `style="padding-left:${depth * 16 + 12}px"`;
    const sub = renderMobileNotebookList(notebooks, nb.id, depth + 1);
    return `
      <div class="mobile-nb-row" data-nb-row="${nb.id}">
        <div class="mobile-nb-row-inner" ${indent}>
          <button type="button" class="mobile-nb-icon-btn" data-notebook-icon="${nb.id}" aria-label="Change icon" title="Change icon">
            ${renderNotebookIcon(nb)}
          </button>
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

function renderNotebookTree(notebooks, parentId = null, depth = 0, { hideEmpty = false } = {}) {
  const children = notebooks.filter((nb) => (nb.parentId || null) === parentId);
  if (!children.length) return "";

  return children.map((notebook) => {
    const subtree = renderNotebookTree(notebooks, notebook.id, depth + 1, { hideEmpty });
    const hasChildren = subtree.length > 0;
    if (hideEmpty && !hasChildren && !Number(notebook.noteCount || 0)) return "";

    const isCollapsed = collapsedNotebooks.has(notebook.id);
    const indent = depth > 0 ? `style="padding-left:${depth * 14}px"` : "";

    return `
      <div class="notebook-row${hasChildren ? " has-children" : ""}${hasChildren && !isCollapsed ? " expanded" : ""}" data-notebook-id="${notebook.id}">
        <div class="notebook-row-inner" ${indent}>
          ${hasChildren ? `
            <button type="button" class="notebook-chevron" data-notebook-toggle="${notebook.id}" aria-label="Toggle" title="Expand/collapse">
              <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ` : `<span class="notebook-chevron-spacer" aria-hidden="true"></span>`}
          <a href="#notebook-${notebook.id}" data-notebook-filter="${notebook.id}" class="notebook-row-link${hasChildren ? "" : " no-chevron"}">
            <span class="notebook-icon">${renderNotebookIcon(notebook)}</span>
            <span class="notebook-row-name">${escapeHtml(notebook.name)}</span>
            <small>${notebook.noteCount || 0}</small>
          </a>
          <div class="notebook-row-actions">
            <button type="button" class="btn-notebook-icon" data-notebook-icon="${notebook.id}" aria-label="Change icon" title="Change icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#palette"/></svg>
            </button>
            <button type="button" class="btn-notebook-rename" data-notebook-rename="${notebook.id}" aria-label="Rename" title="Rename">
              <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#pencil-line"/></svg>
            </button>
            <button type="button" class="btn-notebook-move" data-notebook-move="${notebook.id}" aria-label="Move / nest" title="Move / nest">
              <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#folder-input"/></svg>
            </button>
            <button type="button" class="btn-notebook-delete" data-notebook-delete="${notebook.id}" aria-label="Delete" title="Delete">
              <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#trash-2"/></svg>
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

  const sidebarTree = renderNotebookTree(state.notebooks, null, 0, { hideEmpty: true });
  const fullTree = renderNotebookTree(state.notebooks);
  elements.notebooksList.innerHTML = sidebarTree || '<span class="sidebar-empty">No active notebooks</span>';

  // Also render mobile modal list (uses simpler mobile renderer) and desktop manage panel if open
  if (elements.mobileNotebooksList) {
    elements.mobileNotebooksList.innerHTML = renderMobileNotebookList(state.notebooks) || '<p class="home-empty">No notebooks yet.</p>';
  }
  if (elements.nbManageList && elements.nbManagePanel && !elements.nbManagePanel.hidden) {
    elements.nbManageList.innerHTML = fullTree || '<p style="padding:8px;color:var(--sb-ink-3);font-size:.8rem">No notebooks yet.</p>';
  }

  const visibleTags = state.tags.filter((tag) => tag.noteCount > 0);
  elements.tagsNav.innerHTML = visibleTags.length
    ? visibleTags.map((tag) => `
        <a href="#tag-${escapeHtml(tag.name)}" data-tag-filter="${escapeHtml(tag.name)}">
          <span>#${escapeHtml(tag.name)}</span>
          <small>${tag.noteCount}</small>
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
  // Lit page: Spaces are cover tiles for top-level notebooks (counts include
  // sub-notebooks). Colour = the notebook's own, else a deep default; the CSS
  // blends it toward ink so white text always stays readable.
  const spacePalette = ["#0f7f74", "#55701f", "#9a5a17", "#874486", "#2f57ec", "#a33f33"];
  const totalCount = (nb) => Number(nb.noteCount || 0)
    + state.notebooks.filter((child) => child.parentId === nb.id).reduce((sum, child) => sum + totalCount(child), 0);
  const covers = state.notebooks
    .filter((nb) => !nb.parentId && totalCount(nb) > 0)
    .map((nb, index) => {
      const own = nb.iconColor && nb.iconColor !== "#a0a0a8" ? nb.iconColor : null;
      const color = sanitizeCssColor(own || spacePalette[index % spacePalette.length]) || spacePalette[0];
      const count = totalCount(nb);
      return `<button class="space-cover" type="button" data-notebook-filter="${nb.id}" style="--nb-color:${escapeHtml(color)}">
        <svg class="space-cover-mark" viewBox="0 0 18 15" aria-hidden="true"><rect width="18" height="3" rx="1.5"/><rect y="6" width="12" height="3" rx="1.5"/><rect y="12" width="18" height="3" rx="1.5"/></svg>
        <strong>${escapeHtml(nb.name)}</strong>
        <span>${count} note${count === 1 ? "" : "s"}</span>
      </button>`;
    }).join("");
  elements.homeNotebooks.innerHTML = covers || '<p class="home-empty">Notebooks you add show up here as Spaces.</p>';
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
          <span class="home-card-notebook">${escapeHtml(note.notebookName || (note.tags?.[0] ? `#${note.tags[0]}` : ""))}</span>
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
            <span class="home-card-notebook">${escapeHtml(note.notebookName || (note.tags?.[0] ? `#${note.tags[0]}` : ""))}</span>
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
  if (state.filter === "all" && !state.notebookFilter && !state.tagFilter && !state.forceEditorOpen && !isMobileViewport()) {
    elements.list.classList.add("notes-table-view");
    elements.appShell?.classList.add("table-mode");
    updateNavigationState();
    renderTableView();
    return;
  }
  elements.list.classList.remove("notes-table-view");
  elements.appShell?.classList.remove("table-mode");
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
        <span class="note-card-notebook">${escapeHtml(note.notebookName || (note.tags?.[0] ? `#${note.tags[0]}` : ""))}</span>
        <h3 class="note-card-title">${escapeHtml(note.title || "Untitled note")}${note.favorite ? ' <span class="note-card-star" aria-label="Favorite">★</span>' : ""}</h3>
        <p class="note-card-snippet">${escapeHtml(searchSnippet(note))}</p>
        <time class="note-card-date" datetime="${escapeHtml(note.updatedAt || "")}">${escapeHtml(formatDate(note.updatedAt))}</time>
      </div>
      ${thumb ? `<img class="note-card-thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy" draggable="false">` : ""}
    </article>
  `}).join("");

  elements.list.innerHTML = folderCards + noteCards;
}

function renderTableView() {
  const search = elements.search.value.trim();
  let notes = state.notes.filter((note) => {
    if (state.tableShowArchived) return true;
    return !note.archivedAt;
  });

  if (search) {
    const term = search.toLowerCase();
    notes = notes.filter((note) =>
      (note.title || "").toLowerCase().includes(term) ||
      (note.body || "").toLowerCase().includes(term) ||
      (note.tags || []).join(" ").toLowerCase().includes(term)
    );
  }

  const { col, dir } = state.tableSort;
  notes = [...notes].sort((a, b) => {
    let av, bv;
    if (col === "title") {
      av = (a.title || "").toLowerCase();
      bv = (b.title || "").toLowerCase();
    } else if (col === "tags") {
      av = (a.tags || []).join(",").toLowerCase();
      bv = (b.tags || []).join(",").toLowerCase();
    } else {
      av = a[col] || "";
      bv = b[col] || "";
    }
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });

  const visibleIds = new Set(notes.map((note) => note.id));
  state.tableSelectedIds = new Set([...state.tableSelectedIds].filter((id) => visibleIds.has(id)));
  const selectedCount = state.tableSelectedIds.size;
  const allVisibleSelected = notes.length > 0 && notes.every((note) => state.tableSelectedIds.has(note.id));
  const notebookOptions = [
    '<option value="">Move to notebook...</option>',
    '<option value="none">No notebook</option>',
    ...state.notebooks.map((notebook) => `<option value="${notebook.id}">${escapeHtml(notebook.name)}</option>`)
  ].join("");
  const arrow = (c) => {
    if (state.tableSort.col !== c) return '<span class="tbl-sort-arrow tbl-sort-none">↕</span>';
    return `<span class="tbl-sort-arrow">${state.tableSort.dir === "asc" ? "↑" : "↓"}</span>`;
  };

  const archivedCount = state.notes.filter((n) => n.archivedAt).length;

  const header = `
    <div class="tbl-toolbar">
      <span class="tbl-count">${notes.length} note${notes.length === 1 ? "" : "s"}${search ? ` matching "${search}"` : ""}</span>
      <label class="tbl-archive-toggle">
        <input type="checkbox" data-table-show-archived ${state.tableShowArchived ? "checked" : ""}>
        Show archived${archivedCount ? ` (${archivedCount})` : ""}
      </label>
    </div>
    <div class="tbl-bulk-toolbar${selectedCount ? " active" : ""}">
      <label class="tbl-select-visible">
        <input type="checkbox" data-table-select-all ${allVisibleSelected ? "checked" : ""} ${notes.length ? "" : "disabled"}>
        Select visible
      </label>
      <span class="tbl-selected-count">${selectedCount} selected</span>
      <button type="button" data-bulk-action="favorite" ${selectedCount ? "" : "disabled"}>Favorite</button>
      <button type="button" data-bulk-action="unfavorite" ${selectedCount ? "" : "disabled"}>Unfavorite</button>
      <button type="button" data-bulk-action="archive" ${selectedCount ? "" : "disabled"}>Archive</button>
      <button type="button" data-bulk-action="restore" ${selectedCount ? "" : "disabled"}>Restore</button>
      <select data-bulk-notebook ${selectedCount ? "" : "disabled"}>${notebookOptions}</select>
      <input type="text" data-bulk-tags placeholder="Add tags..." ${selectedCount ? "" : "disabled"}>
      <button type="button" data-bulk-action="add-tags" ${selectedCount ? "" : "disabled"}>Add tags</button>
      <button type="button" class="tbl-danger" data-bulk-action="delete" ${selectedCount ? "" : "disabled"}>Delete</button>
    </div>
    <table class="notes-table">
      <thead>
        <tr>
          <th class="tbl-col-select" aria-label="Select"></th>
          <th class="tbl-col-title" data-sort-col="title">Title ${arrow("title")}</th>
          <th class="tbl-col-tags" data-sort-col="tags">Tags ${arrow("tags")}</th>
          <th class="tbl-col-date" data-sort-col="createdAt">Created ${arrow("createdAt")}</th>
          <th class="tbl-col-date" data-sort-col="updatedAt">Modified ${arrow("updatedAt")}</th>
        </tr>
      </thead>
      <tbody>
        ${notes.length ? notes.map((note) => `
          <tr class="tbl-row${note.id === state.selectedId ? " tbl-row-active" : ""}${note.archivedAt ? " tbl-row-archived" : ""}${state.tableSelectedIds.has(note.id) ? " tbl-row-selected" : ""}" data-note-id="${note.id}">
            <td class="tbl-select-cell">
              <input type="checkbox" data-table-select="${note.id}" aria-label="Select ${escapeHtml(note.title || "Untitled note")}" ${state.tableSelectedIds.has(note.id) ? "checked" : ""}>
            </td>
            <td class="tbl-title">
              ${note.favorite ? '<span class="tbl-star">★</span>' : ""}
              ${escapeHtml(note.title || "Untitled note")}
              ${note.archivedAt ? '<span class="tbl-badge">archived</span>' : ""}
            </td>
            <td class="tbl-tags">${(note.tags || []).map((t) => `<span class="tbl-tag">#${escapeHtml(t)}</span>`).join("")}</td>
            <td class="tbl-date">${escapeHtml(formatDate(note.createdAt))}</td>
            <td class="tbl-date">${escapeHtml(formatDate(note.updatedAt))}</td>
          </tr>
        `).join("") : `
          <tr><td colspan="5" class="tbl-empty">No notes found.${search ? " Try a different search." : ""}</td></tr>
        `}
      </tbody>
    </table>
  `;

  elements.list.innerHTML = header;
  elements.list.classList.add("notes-table-view");
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

async function updateTableNote(note, patch = {}) {
  const payload = await requestJson(`/api/notes/${note.id}`, {
    method: "PUT",
    body: JSON.stringify({
      notebookId: Object.prototype.hasOwnProperty.call(patch, "notebookId") ? patch.notebookId : note.notebookId,
      title: patch.title ?? note.title,
      body: patch.body ?? note.body,
      bodyFormat: patch.bodyFormat ?? note.bodyFormat,
      tags: patch.tags ?? note.tags,
      favorite: patch.favorite ?? note.favorite
    })
  });
  return payload.note || note;
}

function selectedTableNotes() {
  const selected = new Set(state.tableSelectedIds);
  return state.notes.filter((note) => selected.has(note.id));
}

function updateTableNoteState(note) {
  const index = state.notes.findIndex((item) => item.id === note.id);
  if (index >= 0) state.notes[index] = note;
}

async function runBulkTableAction(action) {
  const notes = selectedTableNotes();
  if (!notes.length) return;

  const tagsInput = elements.list.querySelector("[data-bulk-tags]");
  const notebookSelect = elements.list.querySelector("[data-bulk-notebook]");
  const updated = [];
  let failed = 0;

  if (action === "delete" && !window.confirm(`Delete ${notes.length} selected note${notes.length === 1 ? "" : "s"}?`)) {
    return;
  }

  for (const note of notes) {
    try {
      if (action === "delete") {
        await requestJson(`/api/notes/${note.id}`, {
          method: "DELETE",
          body: JSON.stringify({})
        });
        state.notes = state.notes.filter((item) => item.id !== note.id);
        if (state.selectedId === note.id) state.selectedId = null;
        continue;
      }

      let next = note;
      if (action === "favorite" || action === "unfavorite") {
        next = await updateTableNote(note, { favorite: action === "favorite" });
      } else if (action === "add-tags") {
        const newTags = uniqueTags([...(note.tags || []), ...splitTags(tagsInput?.value || "")]);
        next = await updateTableNote(note, { tags: newTags });
      } else if (action === "move") {
        const rawValue = notebookSelect?.value || "";
        const notebookId = rawValue === "none" ? null : Number(rawValue);
        if (!rawValue || (rawValue !== "none" && !Number.isFinite(notebookId))) continue;
        next = await updateTableNote(note, { notebookId });
      } else if (action === "archive" || action === "restore") {
        const shouldArchive = action === "archive";
        if (Boolean(note.archivedAt) !== shouldArchive) {
          const payload = await requestJson(`/api/notes/${note.id}/${shouldArchive ? "archive" : "restore"}`, {
            method: "POST",
            body: JSON.stringify({})
          });
          next = payload.note || note;
        }
      }

      updateTableNoteState(next);
      updated.push(next);
    } catch {
      failed += 1;
    }
  }

  state.tableSelectedIds.clear();
  if (tagsInput) tagsInput.value = "";
  if (notebookSelect) notebookSelect.value = "";
  if (!state.selectedId && state.notes.length) state.selectedId = state.notes[0].id;
  writeCache(cacheKeys.notes, {
    notes: state.notes,
    cachedAt: new Date().toISOString()
  });
  await loadCollections();
  renderTableView();
  renderHomeView();
  setStatus(failed ? `Bulk action finished with ${failed} failed` : `Updated ${action === "delete" ? notes.length : updated.length} selected note${notes.length === 1 ? "" : "s"}`);
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
  "#a0a0a8",
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
  const c = color || "#a0a0a8";
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

  // Center on screen
  picker.style.top = "50%";
  picker.style.left = "50%";
  picker.style.transform = "translate(-50%, -50%)";

  let selectedIcon = currentIcon;
  let selectedColor = currentColor;

  function updatePreview() {
    picker.querySelectorAll(".nb-icon-option").forEach(btn => {
      const active = btn.dataset.iconId === selectedIcon;
      btn.classList.toggle("selected", active);
      // Selected icon shows white on accent background; others show chosen color
      btn.querySelector("svg").style.color = active ? "#fff" : selectedColor;
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
  params.set("limit", "1000");
  if (search) params.set("q", search);
  if (state.notebookFilter) params.set("notebookId", state.notebookFilter);
  if (state.tagFilter) params.set("tag", state.tagFilter);
  if (state.filter === "favorites") params.set("favorite", "1");
  if (state.filter === "tasks") params.set("tasks", "1");
  if (state.filter === "archive") {
    params.set("archived", "only");
  } else if (state.filter === "all" && state.tableShowArchived) {
    params.set("archived", "all");
  } else {
    params.set("archived", "active");
  }

  try {
    const payload = await requestJson(`/api/notes${params.size ? `?${params}` : ""}`);
    state.notes = payload.notes || [];
    if (!state.notebookFilter && !state.tagFilter && state.filter !== "archive" && state.filter !== "favorites" && state.filter !== "tasks" && !search) {
      allNotesCache = state.notes.filter((n) => !n.archivedAt);
    }
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

// The server applies at most this many changes per push.
const syncPushBatchSize = 50;
let flushInFlight = false;
let flushAgainRequested = false;

async function flushPendingChanges() {
  if (flushInFlight) {
    flushAgainRequested = true;
    return;
  }
  const changes = pendingChanges().slice(0, syncPushBatchSize);
  if (!changes.length) return;
  flushInFlight = true;

  try {
    const payload = await requestJson("/api/sync/push", {
      method: "POST",
      body: JSON.stringify({ changes })
    });
    const results = payload.results || [];
    const conflicts = results.filter((result) => result.status === "conflict");
    const appliedById = new Map(results
      .filter((result) => result.status === "applied")
      .map((result) => [result.clientId, result]));
    const sentById = new Map(changes.map((change) => [change.clientId, change]));

    // Re-read the queue: changes may have been queued or coalesced while
    // the request was in flight. Remove only entries that were applied
    // exactly as sent; keep everything else, including changes beyond the
    // batch that the server never saw (previously these were dropped).
    const remaining = [];
    for (const queued of pendingChanges()) {
      const applied = appliedById.get(queued.clientId);
      if (!applied) {
        remaining.push(queued);
        continue;
      }
      if (queued.queuedAt === sentById.get(queued.clientId)?.queuedAt) continue;
      // Newer edits were coalesced into this entry mid-flight. Rebase it on
      // the version the server just produced so it does not self-conflict.
      remaining.push(applied.note?.syncVersion
        ? { ...queued, baseSyncVersion: applied.note.syncVersion }
        : queued);
    }
    writePendingChanges(remaining);
    // Keep draining (e.g. more than one batch queued) only while the server
    // is making progress, so permanently failing entries can't loop.
    if (remaining.length && appliedById.size && !conflicts.length) flushAgainRequested = true;

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
    // Network/server failure: leave the queue exactly as it is now.
    // (Rewriting the pre-request snapshot here erased changes queued
    // while the request was in flight.)
    flushAgainRequested = false;
  } finally {
    flushInFlight = false;
    if (flushAgainRequested) {
      flushAgainRequested = false;
      schedulePendingSync();
    }
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
  setSaveButtonState("saving");
  setStatus(autosave ? "Autosaving..." : "Saving...");

  try {
    const draft = currentDraft();
    const isNewNote = !state.selectedId;
    // Raw field values at send time, so the response only overwrites fields
    // the user has not touched while the request was in flight.
    const sentFields = {
      title: elements.title.value,
      tags: elements.tags.value,
      notebook: elements.notebook.value
    };
    const payload = state.selectedId
      ? await requestJson(`/api/notes/${state.selectedId}`, {
        method: "PUT",
        body: JSON.stringify(draft)
      })
      : await requestJson("/api/notes", {
        method: "POST",
        body: JSON.stringify({ ...draft, clientId: ensureDraftClientId() })
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
      // Refresh state and metadata without touching the editor DOM. Fields
      // edited during the request keep the user's newer value (they will be
      // sent by the follow-up autosave) instead of snapping back.
      state.selectedId = saved.id;
      if (elements.notebook.value === sentFields.notebook) {
        elements.notebook.value = saved.notebookId || "";
      }
      if (elements.tags.value === sentFields.tags) {
        elements.tags.value = (saved.tags || []).join(", ");
      }
      if (elements.title.value === sentFields.title) {
        elements.title.value = saved.title || "Untitled note";
      }
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
    // Only drop the local draft if nothing changed while saving; otherwise it
    // holds keystrokes the server has not seen yet.
    if (draftSignature(currentDraft()) === draftSignature(draft)) {
      clearDraftCache();
    }
    writeCache(cacheKeys.notes, {
      notes: state.notes,
      cachedAt: new Date().toISOString()
    });
    await loadCollections();
    await loadHistory(saved.id);
    setStatus(`${autosave ? "Autosaved" : "Saved"} ${formatDate(saved.updatedAt)}`);
    setCacheStatus("Synced locally", "Server note cached");
    setSaveButtonState("idle");
    return saved;
  } catch (error) {
    setStatus(error.message);
    setSaveButtonState("error");
    queuePendingChange({
      entityType: "note",
      action: state.selectedId ? "update" : "create",
      ...(state.selectedId ? {} : { clientId: ensureDraftClientId() }),
      entityId: state.selectedId,
      baseSyncVersion: currentNote()?.syncVersion,
      data: currentDraft()
    });
    saveDraftCache();
    return null;
  } finally {
    state.pendingSave = false;
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
      setStatus(persisted ? `Image embedded: ${attachment.filename}` : `Image uploaded but not saved yet. Try saving manually.`);
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

function cleanMarkdownTitle(value) {
  return String(value || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Imported note";
}

function markdownMetadataMatch(line) {
  const normalized = String(line || "")
    .trim()
    .replace(/^>\s*/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^(\*\*|__)/, "")
    .replace(/(\*\*|__)$/, "")
    .trim();
  const match = normalized.match(/^(tags?|type)\s*(?:\*\*|__)?\s*[:：-]\s*(.+)$/i);
  if (!match) return null;
  return {
    key: match[1].toLowerCase(),
    value: match[2]
  };
}

function cleanMarkdownMetadataValue(value) {
  return String(value || "")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|www\.)[^)]+\)/gi, "$1")
    .replace(/https?:\/\/[^\s,;|)]+/gi, "")
    .replace(/www\.[^\s,;|)]+/gi, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMarkdownImportMetadata(lines) {
  const metadataLineIndexes = new Set();
  const tagValues = [];
  let type = "";

  lines.forEach((line, index) => {
    const metadata = markdownMetadataMatch(line);
    if (!metadata) return;

    metadataLineIndexes.add(index);
    const value = cleanMarkdownMetadataValue(metadata.value);
    if (!value) return;

    if (metadata.key.startsWith("tag")) {
      tagValues.push(value);
    } else if (!type) {
      type = value;
    }
  });

  return {
    metadataLineIndexes,
    tags: splitCsvTags(tagValues.join(", ")),
    type
  };
}

async function markdownImportDraft(file, content, notebookCache) {
  const text = String(content || "").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/);
  const metadata = parseMarkdownImportMetadata(lines);
  const headingIndex = lines.findIndex((line) => /^#\s+\S/.test(line.trim()));
  const title = headingIndex >= 0
    ? lines[headingIndex].trim().replace(/^#\s+/, "").trim()
    : cleanMarkdownTitle(file.name);
  const bodyMarkdown = headingIndex >= 0
    ? lines.filter((_, index) => index !== headingIndex && !metadata.metadataLineIndexes.has(index)).join("\n").trim()
    : lines.filter((_, index) => !metadata.metadataLineIndexes.has(index)).join("\n").trim();
  const notebookId = await notebookIdForCsvType(metadata.type, notebookCache);

  return {
    notebookId,
    title: title || cleanMarkdownTitle(file.name),
    body: markdownToHtml(bodyMarkdown || text || title),
    bodyFormat: "html",
    favorite: false,
    tags: metadata.tags
  };
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("Could not read file")));
    reader.readAsText(file);
  });
}

async function importMarkdownFiles(files) {
  const markdownFiles = [...files].filter((file) => /\.md$/i.test(file.name));
  if (!markdownFiles.length) {
    elements.importStatus.textContent = "No markdown files selected";
    return;
  }

  elements.importMarkdown.disabled = true;
  elements.importStatus.textContent = `Importing ${markdownFiles.length} file${markdownFiles.length === 1 ? "" : "s"}...`;
  setStatus("Importing markdown");

  const imported = [];
  const failed = [];
  const notebookCache = new Map(state.notebooks.map((notebook) => [notebook.name.toLowerCase(), notebook.id]));

  for (const file of markdownFiles) {
    try {
      const content = await readFileAsText(file);
      const payload = await requestJson("/api/notes", {
        method: "POST",
        body: JSON.stringify(await markdownImportDraft(file, content, notebookCache))
      });
      if (payload.note) imported.push(payload.note);
    } catch (error) {
      failed.push(`${file.name}: ${error.message}`);
    }
  }

  for (const note of imported.reverse()) {
    const index = state.notes.findIndex((item) => item.id === note.id);
    if (index >= 0) state.notes[index] = note;
    else state.notes.unshift(note);
  }

  if (imported.length) {
    state.filter = "all";
    state.notebookFilter = null;
    state.tagFilter = null;
    updateNavigationState();
    renderNotes();
    renderHomeView();
    selectNote(imported[imported.length - 1]);
    writeCache(cacheKeys.notes, {
      notes: state.notes,
      cachedAt: new Date().toISOString()
    });
  }

  elements.importStatus.textContent = failed.length
    ? `Imported ${imported.length}; ${failed.length} failed`
    : `Imported ${imported.length} markdown note${imported.length === 1 ? "" : "s"}`;
  setStatus(failed.length ? "Markdown import finished with errors" : "Markdown import complete");
  elements.importMarkdown.disabled = false;
  elements.markdownImport.value = "";
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  row.push(value);
  if (row.some((cell) => String(cell || "").trim())) rows.push(row);
  return rows;
}

function normalizeCsvKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function csvRecordValue(record, names) {
  const wanted = names.map(normalizeCsvKey);
  const key = Object.keys(record).find((candidate) => wanted.includes(normalizeCsvKey(candidate)));
  return key ? String(record[key] || "").trim() : "";
}

function splitCsvTags(value) {
  return String(value || "")
    .split(/[,;|]/)
    .map((item) => item.replace(/^#/, "").trim())
    .filter(Boolean)
    .filter((item, index, all) => all.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index)
    .slice(0, 24);
}

function csvBoolean(value) {
  return /^(true|yes|y|1|checked|x)$/i.test(String(value || "").trim());
}

function metadataRow(label, value) {
  if (!value) return "";
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function cleanCsvNotebookName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

async function notebookIdForCsvType(type, notebookCache) {
  const name = cleanCsvNotebookName(type);
  if (!name) return state.notebookFilter || null;
  const key = name.toLowerCase();
  if (notebookCache.has(key)) return notebookCache.get(key);

  const existing = state.notebooks.find((notebook) => notebook.name.toLowerCase() === key);
  if (existing) {
    notebookCache.set(key, existing.id);
    return existing.id;
  }

  const created = await createNotebookApi({ name });
  const notebookId = created?.id || null;
  if (notebookId) notebookCache.set(key, notebookId);
  return notebookId;
}

function notionCsvImportDraft(record, file, rowIndex, notebookId = null) {
  const title = csvRecordValue(record, ["Name", "Title"]) || `${cleanMarkdownTitle(file.name)} ${rowIndex}`;
  const tagText = csvRecordValue(record, ["Tag", "Tags"]);
  const type = csvRecordValue(record, ["Type"]);
  const url = csvRecordValue(record, ["URL", "Link"]);
  const favorite = csvBoolean(csvRecordValue(record, ["Favorite"]));
  const archived = csvBoolean(csvRecordValue(record, ["Archived"]));
  const created = csvRecordValue(record, ["Created time", "Created"]);
  const lastEdited = csvRecordValue(record, ["Last edited time", "Last edited", "Updated"]);
  const edited = csvRecordValue(record, ["Edited"]);
  const content = csvRecordValue(record, ["Content", "Body", "Text", "Description", "Notes"]);
  const tags = splitCsvTags(tagText);
  const knownKeys = new Set(["name", "title", "tag", "tags", "type", "url", "link", "favorite", "archived", "createdtime", "created", "lasteditedtime", "lastedited", "updated", "edited", "content", "body", "text", "description", "notes"]);
  const extraRows = Object.entries(record)
    .filter(([key, value]) => String(value || "").trim() && !knownKeys.has(normalizeCsvKey(key)))
    .map(([key, value]) => metadataRow(key, value))
    .join("");
  const metadata = [
    metadataRow("Type", type),
    metadataRow("Tag", tagText),
    metadataRow("Created time", created),
    metadataRow("Last edited time", lastEdited),
    metadataRow("Edited", edited),
    metadataRow("Source file", file.name),
    extraRows
  ].join("");
  const bodyParts = [];

  if (url) {
    bodyParts.push(`<p><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open original Notion page</a></p>`);
  }
  if (content) bodyParts.push(markdownToHtml(content));
  if (metadata) {
    bodyParts.push(`<table><tbody>${metadata}</tbody></table>`);
  }

  return {
    draft: {
      notebookId: notebookId ?? state.notebookFilter ?? null,
      title,
      body: bodyParts.join("") || `<p>${escapeHtml(title)}</p>`,
      bodyFormat: "html",
      favorite,
      tags
    },
    archived
  };
}

function csvImportRecords(content) {
  const rows = parseCsvRows(content);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header, index) => String(header || `Column ${index + 1}`).trim() || `Column ${index + 1}`);
  return rows.slice(1)
    .map((row) => csvRowToRecord(headers, row))
    .filter((record) => Object.values(record).some((value) => String(value || "").trim()))
    .map((record, index) => ({ record, rowIndex: index + 1 }));
}

function csvRowToRecord(headers, row) {
  const tagIndex = headers.findIndex((header) => ["tag", "tags"].includes(normalizeCsvKey(header)));
  const overflow = row.length - headers.length;

  if (tagIndex >= 0 && overflow > 0) {
    const repaired = [];
    for (let headerIndex = 0; headerIndex < headers.length; headerIndex += 1) {
      if (headerIndex < tagIndex) {
        repaired[headerIndex] = row[headerIndex] || "";
      } else if (headerIndex === tagIndex) {
        repaired[headerIndex] = row
          .slice(tagIndex, tagIndex + overflow + 1)
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .join(", ");
      } else {
        repaired[headerIndex] = row[headerIndex + overflow] || "";
      }
    }
    return Object.fromEntries(headers.map((header, headerIndex) => [header, repaired[headerIndex] || ""]));
  }

  return Object.fromEntries(headers.map((header, headerIndex) => [header, row[headerIndex] || ""]));
}

async function importCsvFiles(files) {
  const csvFiles = [...files].filter((file) => /\.csv$/i.test(file.name));
  if (!csvFiles.length) {
    elements.importStatus.textContent = "No CSV files selected";
    return;
  }

  elements.importCsv.disabled = true;
  elements.importStatus.textContent = `Importing ${csvFiles.length} CSV file${csvFiles.length === 1 ? "" : "s"}...`;
  setStatus("Importing CSV");

  const imported = [];
  const failed = [];
  const notebookCache = new Map(
    state.notebooks.map((notebook) => [notebook.name.toLowerCase(), notebook.id])
  );

  for (const file of csvFiles) {
    try {
      const content = await readFileAsText(file);
      const records = csvImportRecords(content);
      if (!records.length) {
        failed.push(`${file.name}: no rows found`);
        continue;
      }

      for (const { record, rowIndex } of records) {
        const notebookId = await notebookIdForCsvType(csvRecordValue(record, ["Type"]), notebookCache);
        const item = notionCsvImportDraft(record, file, rowIndex, notebookId);
        try {
          const payload = await requestJson("/api/notes", {
            method: "POST",
            body: JSON.stringify(item.draft)
          });
          if (payload.note) {
            let note = payload.note;
            if (item.archived) {
              const archivedPayload = await requestJson(`/api/notes/${note.id}/archive`, { method: "POST" });
              note = archivedPayload.note || note;
            }
            imported.push(note);
          }
        } catch (error) {
          failed.push(`${item.draft.title}: ${error.message}`);
        }
      }
    } catch (error) {
      failed.push(`${file.name}: ${error.message}`);
    }
  }

  for (const note of imported.reverse()) {
    const index = state.notes.findIndex((item) => item.id === note.id);
    if (index >= 0) state.notes[index] = note;
    else state.notes.unshift(note);
  }

  if (imported.length) {
    state.filter = "all";
    state.notebookFilter = null;
    state.tagFilter = null;
    updateNavigationState();
    renderNotes();
    renderHomeView();
    selectNote(imported[imported.length - 1]);
    writeCache(cacheKeys.notes, {
      notes: state.notes,
      cachedAt: new Date().toISOString()
    });
  }

  elements.importStatus.textContent = failed.length
    ? `Imported ${imported.length}; ${failed.length} failed`
    : `Imported ${imported.length} CSV note${imported.length === 1 ? "" : "s"}`;
  setStatus(failed.length ? "CSV import finished with errors" : "CSV import complete");
  elements.importCsv.disabled = false;
  elements.csvImport.value = "";
}

function csvTitleKey(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function fetchAllNotesForRepair() {
  const payload = await requestJson("/api/notes?archived=all&limit=1000");
  return payload.notes || [];
}

async function updateNoteFromCsvRepair(note, item) {
  const payload = await requestJson(`/api/notes/${note.id}`, {
    method: "PUT",
    body: JSON.stringify({
      notebookId: item.draft.notebookId,
      title: note.title,
      body: note.body,
      bodyFormat: note.bodyFormat || "html",
      tags: item.draft.tags,
      favorite: item.draft.favorite
    })
  });
  let updated = payload.note || note;

  if (item.archived && !updated.archivedAt) {
    const archivedPayload = await requestJson(`/api/notes/${updated.id}/archive`, { method: "POST" });
    updated = archivedPayload.note || updated;
  } else if (!item.archived && updated.archivedAt) {
    const restoredPayload = await requestJson(`/api/notes/${updated.id}/restore`, { method: "POST" });
    updated = restoredPayload.note || updated;
  }

  return updated;
}

async function repairCsvFiles(files) {
  const csvFiles = [...files].filter((file) => /\.csv$/i.test(file.name));
  if (!csvFiles.length) {
    elements.importStatus.textContent = "No CSV files selected";
    return;
  }

  elements.repairCsv.disabled = true;
  elements.importStatus.textContent = `Repairing from ${csvFiles.length} CSV file${csvFiles.length === 1 ? "" : "s"}...`;
  setStatus("Repairing CSV import");

  const repaired = [];
  const missing = [];
  const failed = [];

  try {
    const allNotes = await fetchAllNotesForRepair();
    const notesByTitle = new Map();
    for (const note of allNotes) {
      const key = csvTitleKey(note.title);
      if (!key) continue;
      if (!notesByTitle.has(key)) notesByTitle.set(key, []);
      notesByTitle.get(key).push(note);
    }

    const notebookCache = new Map(
      state.notebooks.map((notebook) => [notebook.name.toLowerCase(), notebook.id])
    );
    const usedNoteIds = new Set();

    for (const file of csvFiles) {
      try {
        const content = await readFileAsText(file);
        const records = csvImportRecords(content);
        if (!records.length) {
          failed.push(`${file.name}: no rows found`);
          continue;
        }

        for (const { record, rowIndex } of records) {
          const notebookId = await notebookIdForCsvType(csvRecordValue(record, ["Type"]), notebookCache);
          const item = notionCsvImportDraft(record, file, rowIndex, notebookId);
          const key = csvTitleKey(item.draft.title);
          const matches = notesByTitle.get(key) || [];
          const note = matches.find((candidate) => !usedNoteIds.has(candidate.id));

          if (!note) {
            missing.push(item.draft.title);
            continue;
          }

          try {
            const updated = await updateNoteFromCsvRepair(note, item);
            usedNoteIds.add(note.id);
            repaired.push(updated);
          } catch (error) {
            failed.push(`${item.draft.title}: ${error.message}`);
          }
        }
      } catch (error) {
        failed.push(`${file.name}: ${error.message}`);
      }
    }
  } finally {
    elements.repairCsv.disabled = false;
    elements.csvRepair.value = "";
  }

  if (repaired.length) {
    await loadCollections();
    await loadNotes();
    renderHomeView();
    const selected = repaired.find((note) => note.id === state.selectedId) || repaired[repaired.length - 1];
    if (selected) selectNote(selected);
  }

  const details = [];
  if (missing.length) details.push(`${missing.length} not found`);
  if (failed.length) details.push(`${failed.length} failed`);
  elements.importStatus.textContent = details.length
    ? `Repaired ${repaired.length}; ${details.join("; ")}`
    : `Repaired ${repaired.length} note${repaired.length === 1 ? "" : "s"}`;
  setStatus(details.length ? "CSV repair finished with notes to review" : "CSV repair complete");
}

function createNewNote() {
  state.forceEditorOpen = true;
  state.localDraftRestored = true;
  state.selectedId = null;
  state.draftClientId = null;
  state.tableShowArchived = false;
  if (state.filter === "home") {
    state.filter = "all";
    updateNavigationState();
  }
  setMobilePanel("editor");
  elements.notebook.value = state.notebookFilter || "";
  elements.tags.value = "";
  elements.title.value = "Untitled note";
  setEditorHtml("");
  updateWordCount();
  updateToolbarState();
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
    // ⌘K / Ctrl+K opens the command bar (search, actions, ask).
    if (typeof openCommandBar === "function" && document.querySelector("[data-cmd]")) {
      toggleCommandBar();
    } else {
      elements.search.focus();
      elements.search.select();
    }
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


// ── @mention note linking ─────────────────────────────────────────
let mentionState = null; // { startRange, query }

function getMentionDropdown() {
  let el = document.getElementById("mention-dropdown");
  if (!el) {
    el = document.createElement("div");
    el.id = "mention-dropdown";
    el.className = "mention-dropdown";
    el.setAttribute("role", "listbox");
    document.body.appendChild(el);
  }
  return el;
}

function closeMentionDropdown() {
  const el = document.getElementById("mention-dropdown");
  if (el) el.remove();
  mentionState = null;
}

function positionDropdown(el) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  const dropH = 240;
  const spaceBelow = window.innerHeight - rect.bottom;
  el.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 260)}px`;
  if (spaceBelow < dropH) {
    el.style.top = `${rect.top + window.scrollY - el.offsetHeight - 4}px`;
  } else {
    el.style.top = `${rect.bottom + window.scrollY + 4}px`;
  }
}

function renderMentionDropdown(query) {
  const term = query.toLowerCase();
  const pool = allNotesCache.length ? allNotesCache : state.notes.filter((n) => !n.archivedAt);
  const matches = pool
    .filter((n) => n.id !== state.selectedId)
    .filter((n) => !term || (n.title || "").toLowerCase().includes(term))
    .slice(0, 8);

  const el = getMentionDropdown();

  if (!matches.length) {
    el.innerHTML = `<div class="mention-empty">No matching notes</div>`;
  } else {
    el.innerHTML = matches.map((n, i) => `
      <div class="mention-item" role="option" data-mention-id="${n.id}" data-mention-index="${i}">
        <span class="mention-title">${escapeHtml(n.title || "Untitled note")}</span>
        ${n.notebookName ? `<span class="mention-nb">${escapeHtml(n.notebookName)}</span>` : ""}
      </div>
    `).join("");
  }

  positionDropdown(el);
}

function insertNoteLink(note) {
  if (!mentionState) return;
  const sel = window.getSelection();
  if (!sel) return;

  // Build a range from the @ sign to the current cursor
  const range = mentionState.startRange.cloneRange();
  range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);

  // Delete the typed @query text
  range.deleteContents();

  // Insert the note link as a span (survives sanitizer cleanly)
  const link = document.createElement("span");
  link.className = "note-link";
  link.dataset.noteLink = note.id;
  link.textContent = `@${note.title || "Untitled note"}`;
  range.insertNode(link);

  // Move cursor after the link
  const after = document.createTextNode(" ");
  link.after(after);
  const newRange = document.createRange();
  newRange.setStartAfter(after);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);

  closeMentionDropdown();
  scheduleAutoSave();
}

function handleMentionKeydown(event) {
  if (!mentionState) return false;
  const el = document.getElementById("mention-dropdown");
  if (!el) return false;
  const items = el.querySelectorAll(".mention-item");
  const active = el.querySelector(".mention-item.mention-active");
  const activeIdx = active ? Number(active.dataset.mentionIndex) : -1;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    const next = el.querySelector(`[data-mention-index="${Math.min(activeIdx + 1, items.length - 1)}"]`);
    items.forEach((i) => i.classList.remove("mention-active"));
    next?.classList.add("mention-active");
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    const prev = el.querySelector(`[data-mention-index="${Math.max(activeIdx - 1, 0)}"]`);
    items.forEach((i) => i.classList.remove("mention-active"));
    prev?.classList.add("mention-active");
    return true;
  }
  if (event.key === "Enter" || event.key === "Tab") {
    const target = active || items[0];
    if (target) {
      event.preventDefault();
      const note = state.notes.find((n) => n.id === Number(target.dataset.mentionId));
      if (note) insertNoteLink(note);
      return true;
    }
  }
  if (event.key === "Escape") {
    closeMentionDropdown();
    return true;
  }
  return false;
}

function handleMentionInput() {
  const sel = window.getSelection();
  if (!sel.rangeCount) { closeMentionDropdown(); return; }

  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) { closeMentionDropdown(); return; }

  const text = node.textContent.slice(0, range.startOffset);
  const atIdx = text.lastIndexOf("@");

  if (atIdx === -1) { closeMentionDropdown(); return; }

  // Make sure there's no space between @ and cursor (spaces end the mention)
  const query = text.slice(atIdx + 1);
  if (query.includes(" ")) { closeMentionDropdown(); return; }

  if (!mentionState) {
    const startRange = document.createRange();
    startRange.setStart(node, atIdx);
    startRange.collapse(true);
    mentionState = { startRange, query };
  } else {
    mentionState.query = query;
  }

  renderMentionDropdown(query);
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
  // The lit-page layout starts with the compact dock; an explicit "0" keeps it expanded.
  if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== "0") {
    elements.appShell?.classList.add("sidebar-collapsed");
  }

  // Notes drawer: the list slides away so the page can take the stage.
  const DRAWER_CLOSED_KEY = "edge_drawer_closed";
  const drawerToggle = document.querySelector("[data-drawer-toggle]");
  function applyDrawer(closed, persist = true) {
    elements.appShell?.classList.toggle("drawer-closed", closed);
    if (drawerToggle) {
      drawerToggle.setAttribute("aria-pressed", closed ? "false" : "true");
      drawerToggle.setAttribute("aria-label", closed ? "Show notes list" : "Hide notes list");
    }
    if (persist) {
      try { localStorage.setItem(DRAWER_CLOSED_KEY, closed ? "1" : "0"); } catch {}
    }
  }
  applyDrawer(localStorage.getItem(DRAWER_CLOSED_KEY) === "1", false);
  drawerToggle?.addEventListener("click", () => {
    applyDrawer(!elements.appShell?.classList.contains("drawer-closed"));
  });
  // Picking a list (Notes, a notebook, a tag) brings the drawer back.
  document.addEventListener("click", (event) => {
    if (event.target.closest(".sidebar [data-view-filter]:not([data-view-filter='home']), [data-notebook-filter], [data-tag-filter]")) {
      if (elements.appShell?.classList.contains("drawer-closed")) applyDrawer(false);
    }
  });
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

    if (panel === "notebooks") {
      openNotebooksModal();
      return;
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
    button.addEventListener("mousedown", (event) => {
      captureEditorSelection();
      state.suppressSelectionSave = true;
      event.preventDefault(); // prevent editor losing focus
    });
    button.addEventListener("click", () => {
      applyWysiwygFormat(button.dataset.format);
      requestAnimationFrame(() => {
        state.suppressSelectionSave = false;
        updateToolbarState();
      });
    });
  });
  elements.formatSelects.forEach((select) => {
    select.addEventListener("mousedown", saveSelection);
    select.addEventListener("change", () => {
      applyToolbarSelect(select.dataset.formatSelect, select.value);
      updateToolbarState();
    });
  });
  elements.formatColorInputs.forEach((input) => {
    input.closest(".toolbar-color")?.style.setProperty("--toolbar-swatch", input.value);
    input.addEventListener("mousedown", saveSelection);
    // so the swatch updates immediately and the format is applied on picker close.
    input.addEventListener("input", () => {
      input.closest(".toolbar-color")?.style.setProperty("--toolbar-swatch", input.value);
    });
    input.addEventListener("change", () => {
      input.closest(".toolbar-color")?.style.setProperty("--toolbar-swatch", input.value);
      applyToolbarColor(input.dataset.formatColor, input.value);
      updateToolbarState();
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
  elements.importMarkdown.addEventListener("click", () => elements.markdownImport.click());
  elements.importCsv?.addEventListener("click", () => elements.csvImport.click());
  elements.repairCsv?.addEventListener("click", () => elements.csvRepair.click());
  elements.markdownImport.addEventListener("change", (event) => {
    importMarkdownFiles(event.target.files || []);
  });
  elements.csvImport?.addEventListener("change", (event) => {
    importCsvFiles(event.target.files || []);
  });
  elements.csvRepair?.addEventListener("change", (event) => {
    repairCsvFiles(event.target.files || []);
  });

  elements.passwordForm.addEventListener("submit", changePassword);

  elements.title.addEventListener("input", () => {
    // A title is one line: flatten pasted line breaks.
    if (/\n/.test(elements.title.value)) {
      elements.title.value = elements.title.value.replace(/\s*\n\s*/g, " ");
    }
    autosizeTitle();
    saveDraftCache();
    scheduleAutoSave();
  });
  elements.title.addEventListener("keydown", (event) => {
    // Enter moves into the note body. Skip while an IME (e.g. Korean) is
    // composing, where Enter confirms the character instead.
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    elements.body.focus();
  });
  watchTitleSize();
  elements.body.addEventListener("beforeinput", (event) => {
    if (event.inputType === "insertText" && state.pendingInlineFormats.size && event.data) {
      event.preventDefault();
      insertPendingFormattedText(event.data);
      return;
    }
    if (event.inputType === "insertParagraph") {
      const range = activeToolbarRange();
      const code = codeNodeNearRange(range);
      if (state.pendingInlineFormats.has("code") || code) {
        event.preventDefault();
        clearPendingInlineFormats();
        if (insertParagraphAfterInlineNode(code)) return;
        const paragraph = document.createElement("p");
        paragraph.innerHTML = "<br>";
        elements.body.append(paragraph);
        placeCaretInNode(paragraph, false);
        notifyEditorChanged();
        updateToolbarState();
        return;
      }
      const node = range?.startContainer?.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range?.startContainer?.parentElement;
      const quote = node?.closest?.("blockquote");
      if (quote && quote.parentElement === elements.body) {
        event.preventDefault();
        clearPendingInlineFormats();
        const paragraph = document.createElement("p");
        paragraph.innerHTML = "<br>";
        quote.after(paragraph);
        placeCaretInNode(paragraph, false);
        notifyEditorChanged();
        updateToolbarState();
        return;
      }
      clearPendingInlineFormats();
      updateToolbarState();
    }
  });
  elements.body.addEventListener("input", () => {
    saveDraftCache();
    renderTasks();
    updateWordCount();
    updateToolbarState();
    if (state.attachments.length) renderAttachments();
    scheduleAutoSave();
    handleMentionInput();
  });
  elements.body.addEventListener("keyup", () => {
    saveSelection();
    updateToolbarState();
  });
  elements.body.addEventListener("mouseup", () => {
    saveSelection();
    updateToolbarState();
  });
  document.addEventListener("selectionchange", () => {
    saveSelection();
    updateToolbarState();
  });

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
    if (handleMentionKeydown(event)) return;
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
  // rewrite the checked state underneath us. The click fallback covers
  elements.body.addEventListener("pointerdown", handleChecklistToggleEvent, true);
  elements.body.addEventListener("click", handleChecklistToggleEvent, true);

  // Note link clicks — navigate to the linked note
  elements.body.addEventListener("click", (event) => {
    const link = event.target.closest("span.note-link[data-note-link]");
    if (link) {
      event.preventDefault();
      const noteId = Number(link.dataset.noteLink);
      if (!noteId) return;
      // Check allNotesCache first so we can get the notebookId even if the note
      // isn't in the current filtered list
      const cached = allNotesCache.find((n) => n.id === noteId) || state.notes.find((n) => n.id === noteId);
      if (cached) {
        // Navigate into the note's notebook so we land in editor view, not table view
        state.tagFilter = null;
        if (cached.notebookId) {
          state.filter = "all";
          state.notebookFilter = Number(cached.notebookId);
        } else {
          state.filter = "home";
          state.notebookFilter = null;
        }
        loadNotes().then(() => {
          const found = state.notes.find((n) => n.id === noteId);
          if (found) selectNote(found);
          else selectNote(cached); // use cached data as fallback
        });
      } else {
        setStatus("Linked note not found");
      }
      return;
    }
  });

  // Close mention dropdown when clicking outside
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#mention-dropdown") && !event.target.closest("[data-note-body]")) {
      closeMentionDropdown();
    }
  });
  // before the editor blur event can close the dropdown, and before the click event fires.
  document.addEventListener("mousedown", (event) => {
    const item = event.target.closest(".mention-item");
    if (!item) return;
    event.preventDefault(); // prevent editor blur, keep mentionState alive
    const id = Number(item.dataset.mentionId);
    const note = allNotesCache.find((n) => n.id === id) || state.notes.find((n) => n.id === id);
    if (note) insertNoteLink(note);
  });
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
    if (link.dataset.viewFilter !== "all") state.tableShowArchived = false;
    state.forceEditorOpen = false;
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
        state.forceEditorOpen = false;
        state.filter = seeAll.dataset.viewFilter;
        state.notebookFilter = null;
        state.tagFilter = null;
        loadNotes();
        return;
      }
      // Home notebook card
      const nbCard = event.target.closest("[data-notebook-filter]");
      if (nbCard) {
        state.forceEditorOpen = false;
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
          state.forceEditorOpen = true;
          state.tableShowArchived = false;
          state.tagFilter = null;
          state.filter = "all";
          state.notebookFilter = note.notebookId ? Number(note.notebookId) : null;
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
  elements.nbManageList?.addEventListener("click", handleNotebookListClick);

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
      setTimeout(() => { elements.mobileFormatBar.hidden = true; }, 150);
    });
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
          updateToolbarState();
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

    // Table view: sort column header
    const sortTh = event.target.closest("[data-sort-col]");
    if (sortTh) {
      const col = sortTh.dataset.sortCol;
      if (state.tableSort.col === col) {
        state.tableSort.dir = state.tableSort.dir === "asc" ? "desc" : "asc";
      } else {
        state.tableSort.col = col;
        state.tableSort.dir = col === "title" || col === "tags" ? "asc" : "desc";
      }
      renderTableView();
      return;
    }

    // Table view: archive toggle checkbox
    const archiveToggle = event.target.closest("[data-table-show-archived]");
    if (archiveToggle) {
      state.tableShowArchived = archiveToggle.checked;
      loadNotes();
      return;
    }

    const selectAll = event.target.closest("[data-table-select-all]");
    if (selectAll) {
      const visibleIds = [...elements.list.querySelectorAll("[data-table-select]")]
        .map((input) => Number(input.dataset.tableSelect))
        .filter(Number.isFinite);
      if (selectAll.checked) {
        visibleIds.forEach((id) => state.tableSelectedIds.add(id));
      } else {
        visibleIds.forEach((id) => state.tableSelectedIds.delete(id));
      }
      renderTableView();
      return;
    }

    const rowSelect = event.target.closest("[data-table-select]");
    if (rowSelect) {
      const noteId = Number(rowSelect.dataset.tableSelect);
      if (rowSelect.checked) state.tableSelectedIds.add(noteId);
      else state.tableSelectedIds.delete(noteId);
      renderTableView();
      return;
    }

    const bulkNotebook = event.target.closest("[data-bulk-notebook]");
    if (bulkNotebook && bulkNotebook.value) {
      runBulkTableAction("move");
      return;
    }

    const bulkAction = event.target.closest("[data-bulk-action]");
    if (bulkAction) {
      runBulkTableAction(bulkAction.dataset.bulkAction);
      return;
    }

    const card = event.target.closest("[data-note-id]");
    if (!card) return;
    const note = state.notes.find((item) => item.id === Number(card.dataset.noteId));
    if (!note) return;

    // In table mode, navigate into the note's notebook (or all notes) then select it
    if (elements.appShell?.classList.contains("table-mode")) {
      state.forceEditorOpen = true;
      state.tableShowArchived = false;
      state.filter = note.notebookId ? "all" : "all";
      state.notebookFilter = note.notebookId || null;
      state.tagFilter = null;
      elements.appShell.classList.remove("table-mode");
      loadNotes().then(() => selectNote(note));
      setMobilePanel("editor");
      return;
    }

    selectNote(note);
  });

  elements.list.addEventListener("change", (event) => {
    const bulkNotebook = event.target.closest("[data-bulk-notebook]");
    if (bulkNotebook && bulkNotebook.value) {
      runBulkTableAction("move");
    }
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
    if (sessionStorage.getItem(internalNavigationFlag) === "1") {
      sessionStorage.removeItem(internalNavigationFlag);
      return;
    }
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
  const requestedNoteId = requestedNoteIdFromUrl();
  if (requestedNoteId) {
    await openNoteById(requestedNoteId).catch(() => {});
  }
  // Prime the mention search cache with all active notes in the background
  requestJson("/api/notes?archived=active&limit=1000")
    .then((p) => { allNotesCache = (p.notes || []).filter((n) => !n.archivedAt); })
    .catch(() => {});
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

/* ─── Theme management ───────────────────────────────────────── */
(function () {
  const THEME_KEY = "edge_theme";
  const root = document.documentElement;

  function applyTheme(theme) {
    // Remove system-dark helper class before re-evaluating
    root.classList.remove("system-dark");
    root.setAttribute("data-theme", theme);

    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) root.classList.add("system-dark");
    }

    // Update active button state in settings
    document.querySelectorAll("[data-theme-set]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.themeSet === theme);
    });
  }

  function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  }

  // Apply saved theme immediately (before paint)
  const saved = localStorage.getItem(THEME_KEY) || "system";
  applyTheme(saved);

  // Wire up buttons (settings panel may not exist yet — use delegation)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-theme-set]");
    if (btn) setTheme(btn.dataset.themeSet);
  });

  // Also re-apply active state whenever settings panel opens
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-action='open-settings']")) {
      const current = localStorage.getItem(THEME_KEY) || "system";
      document.querySelectorAll("[data-theme-set]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.themeSet === current);
      });
    }
  });

  // React to system preference changes when in system mode
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if ((localStorage.getItem(THEME_KEY) || "system") === "system") {
      applyTheme("system");
    }
  });
})();

/* ─── Custom tag autocomplete dropdown ───────────────────────── */
(function () {
  const tagsInput = document.querySelector("[data-note-tags]");
  const dropdown  = document.querySelector("[data-tag-dropdown]");
  const tagsList  = document.querySelector("[data-tags-list]");
  if (!tagsInput || !dropdown) return;

  let activeIdx = -1;

  function getKnownTags() {
    return Array.from(tagsList?.options || []).map((o) => o.value).filter(Boolean);
  }

  function getCurrentTags() {
    const val = tagsInput.value;
    const parts = val.split(",");
    return parts.slice(0, -1).map((t) => t.trim().toLowerCase());
  }

  function getTyping() {
    const val = tagsInput.value;
    const parts = val.split(",");
    return parts[parts.length - 1].trim().toLowerCase();
  }

  function positionDropdown() {
    const rect = tagsInput.getBoundingClientRect();
    dropdown.style.top  = (rect.bottom + 4) + "px";
    dropdown.style.left = rect.left + "px";
    dropdown.style.minWidth = Math.max(rect.width, 180) + "px";
  }

  function renderDropdown(query) {
    const known   = getKnownTags();
    const already = getCurrentTags();
    const filtered = known.filter((t) =>
      t.includes(query) && !already.includes(t)
    );

    if (!filtered.length) {
      dropdown.hidden = true;
      return;
    }

    activeIdx = -1;
    dropdown.innerHTML = filtered
      .slice(0, 12)
      .map((t, i) => `<div class="tag-dropdown-item" data-tag="${t}">${t}</div>`)
      .join("");

    positionDropdown();
    dropdown.hidden = false;
  }

  function applyTag(tag) {
    const val   = tagsInput.value;
    const parts = val.split(",");
    parts[parts.length - 1] = " " + tag;
    tagsInput.value = parts.join(",") + ", ";
    dropdown.hidden = true;
    activeIdx = -1;
    tagsInput.focus();
    tagsInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function setActive(idx) {
    const items = dropdown.querySelectorAll(".tag-dropdown-item");
    items.forEach((el, i) => el.classList.toggle("active", i === idx));
    activeIdx = idx;
  }

  tagsInput.addEventListener("input", () => {
    const q = getTyping();
    if (q.length === 0) { dropdown.hidden = true; return; }
    renderDropdown(q);
  });

  tagsInput.addEventListener("keydown", (e) => {
    if (dropdown.hidden) return;
    const items = dropdown.querySelectorAll(".tag-dropdown-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIdx + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIdx - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (activeIdx >= 0 && items[activeIdx]) {
        e.preventDefault();
        applyTag(items[activeIdx].dataset.tag);
      }
    } else if (e.key === "Escape") {
      dropdown.hidden = true;
    }
  });

  tagsInput.addEventListener("blur", () => {
    setTimeout(() => { dropdown.hidden = true; }, 120);
  });

  dropdown.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".tag-dropdown-item");
    if (item) { e.preventDefault(); applyTag(item.dataset.tag); }
  });

  // Reposition on scroll/resize
  window.addEventListener("scroll", () => { if (!dropdown.hidden) positionDropdown(); }, true);
  window.addEventListener("resize", () => { if (!dropdown.hidden) positionDropdown(); });
})();

// Graph nav links: open the graph centred on the note being edited.
// (Previously an inline <script> in index.html, which the CSP's
// script-src 'self' blocked, so it never ran.)
document.querySelectorAll('a[href="/graph.html"], [data-graph-link]').forEach((link) => {
  link.addEventListener("click", (event) => {
    markInternalNavigation();
    const selectedId = state.selectedId || readCache(cacheKeys.selectedId, null);
    if (selectedId) {
      event.preventDefault();
      window.location.href = `/graph.html?note=${encodeURIComponent(selectedId)}`;
    }
  });
});

// Lucide icon sprite: inject once so <use href="#icon"> references resolve.
// (Previously an inline <script> in index.html, blocked by the CSP.)
fetch("/lucide-sprite.svg")
  .then((response) => (response.ok ? response.text() : ""))
  .then((svg) => {
    const container = document.getElementById("lucide-sprite-container");
    if (container && svg) container.innerHTML = svg;
  })
  .catch(() => {});

// ═══ AI assistant ══════════════════════════════════════════════════════
// Panel with one-tap actions on the open note (summarize, action items,
// tags, title, clean up, translate KO⇄EN, related) and questions about this
// note or all notes. Every "apply" edits the note through the same input
// events as typing, so autosave, draft cache and version history all apply.
const ai = {
  panel: document.querySelector("[data-ai-panel]"),
  openButton: document.querySelector("[data-ai-open]"),
  closeButton: document.querySelector("[data-ai-close]"),
  model: document.querySelector("[data-ai-model]"),
  form: document.querySelector("[data-ai-ask-form]"),
  question: document.querySelector("[data-ai-question]"),
  result: document.querySelector("[data-ai-result]"),
  voiceButton: document.querySelector("[data-voice-toggle]"),
  status: null,
  busy: false,
  last: null
};

function aiList(value) {
  if (Array.isArray(value)) return value.map((item) => String(typeof item === "object" ? (item.text || item.task || item.title || JSON.stringify(item)) : item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\n+/).map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
  return [];
}

function noteEdited(target) {
  target.dispatchEvent(new Event("input", { bubbles: true }));
}

async function ensureNoteSavedForAi() {
  // The server reads the stored note, so save pending edits first.
  if (state.selectedId && !hasMeaningfulDraft() && !state.pendingSave) return state.selectedId;
  const saved = await saveNote();
  if (!saved?.id && !state.selectedId) throw new Error("Save the note first (it needs some content).");
  return saved?.id || state.selectedId;
}

function setAiBusy(busy, label = "") {
  ai.busy = busy;
  ai.panel.classList.toggle("is-busy", busy);
  ai.panel.querySelectorAll("[data-ai-action], .ai-submit").forEach((button) => { button.disabled = busy; });
  if (busy) ai.result.innerHTML = `<div class="ai-loading"><span class="ai-spinner" aria-hidden="true"></span>${escapeHtml(label)}…</div>`;
}

function showAiError(error) {
  ai.result.innerHTML = `<div class="ai-error"><strong>Couldn't finish that.</strong><p>${escapeHtml(error.message || "Something went wrong.")}</p></div>`;
}

async function loadAiStatus() {
  if (ai.status) return ai.status;
  try {
    ai.status = await requestJson("/api/ai/status");
  } catch (error) {
    ai.status = { ok: false, configured: false, message: error.message };
  }
  ai.model.textContent = ai.status.ok
    ? `${ai.status.modelName}`
    : (ai.status.configured ? "AI unavailable. Check the server key." : "AI not set up on the server");
  ai.model.classList.toggle("is-off", !ai.status.ok);
  if (ai.voiceButton) ai.voiceButton.hidden = ai.status.voice === false;
  return ai.status;
}

function openAiPanel() {
  ai.panel.hidden = false;
  ai.openButton?.setAttribute("aria-expanded", "true");
  document.body.classList.add("ai-panel-open");
  loadAiStatus();
  if (!ai.last) {
    ai.result.innerHTML = '<p class="ai-hint">Pick an action for this note, or ask a question. Results never change your note until you choose to apply them.</p>';
  }
}

function closeAiPanel() {
  ai.panel.hidden = true;
  ai.openButton?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("ai-panel-open");
}

const aiLabels = {
  summarize: "Summarizing",
  "extract-tasks": "Finding action items",
  "suggest-tags": "Suggesting tags",
  "create-title": "Writing a title",
  "clean-up": "Cleaning up",
  translate: "Translating",
  "find-related": "Finding related notes",
  "ask-note": "Reading the note",
  "ask-all": "Searching your notes"
};

async function runAiNoteAction(action, question = "", options = {}) {
  if (ai.busy) return;
  setAiBusy(true, aiLabels[action] || "Working");
  try {
    const noteId = await ensureNoteSavedForAi();
    const payload = await requestJson(`/api/notes/${noteId}/ai`, {
      method: "POST",
      body: JSON.stringify({ action, question })
    });
    ai.last = { action, output: payload.output || {}, noteId, question, replace: options.replace || null, label: options.label || "" };
    renderAiResult();
  } catch (error) {
    showAiError(error);
  } finally {
    setAiBusy(false);
    if (ai.result.querySelector(".ai-loading")) ai.result.innerHTML = "";
  }
}

async function askAllNotesAi(question) {
  if (ai.busy) return;
  setAiBusy(true, aiLabels["ask-all"]);
  try {
    const payload = await requestJson("/api/ai/ask", { method: "POST", body: JSON.stringify({ question }) });
    ai.last = { action: "ask-all", output: payload, question };
    renderAiResult();
  } catch (error) {
    showAiError(error);
  } finally {
    setAiBusy(false);
    if (ai.result.querySelector(".ai-loading")) ai.result.innerHTML = "";
  }
}

function aiCard(title, body, buttons = "") {
  return `<section class="ai-card"><h3>${escapeHtml(title)}</h3>${body}${buttons ? `<div class="ai-card-actions">${buttons}</div>` : ""}</section>`;
}

function aiButton(apply, label, primary = false) {
  return `<button type="button" class="${primary ? "ai-apply is-primary" : "ai-apply"}" data-ai-apply="${apply}">${escapeHtml(label)}</button>`;
}

function renderAiResult() {
  const { action, output, question } = ai.last;
  let html = "";

  if (action === "summarize") {
    const points = aiList(output.summary || output.bullets || output.points || output.text);
    html = aiCard("Summary", `<ul>${points.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`,
      aiButton("summary-top", "Add to top of note", true) + aiButton("copy", "Copy"));
  } else if (action === "extract-tasks") {
    const tasks = aiList(output.tasks || output.items || output.text);
    html = tasks.length
      ? aiCard("Action items", `<ul class="ai-tasks">${tasks.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`,
        aiButton("tasks-append", "Add as checklist", true) + aiButton("copy", "Copy"))
      : aiCard("Action items", "<p>No open action items in this note.</p>");
  } else if (action === "suggest-tags") {
    const existing = new Set(splitTags(elements.tags.value).map((t) => t.toLowerCase()));
    const tags = aiList(output.tags || output.text).map((t) => t.replace(/^#/, "").toLowerCase().replace(/\s+/g, "-")).filter((t) => t && !existing.has(t));
    html = tags.length
      ? aiCard("Suggested tags", `<div class="ai-tags">${tags.map((t) => `<label class="ai-tag"><input type="checkbox" value="${escapeHtml(t)}" checked> #${escapeHtml(t)}</label>`).join("")}</div>`,
        aiButton("tags-add", "Add selected tags", true))
      : aiCard("Suggested tags", "<p>This note's tags already cover it.</p>");
  } else if (action === "create-title") {
    const title = String(output.title || output.text || "").replace(/^["'“”]+|["'“”]+$/g, "").trim();
    html = aiCard("Suggested title", `<p class="ai-title">${escapeHtml(title)}</p>`, aiButton("title-use", "Use this title", true));
    ai.last.title = title;
  } else if (action === "clean-up" || action === "translate") {
    const markdown = String(output.markdown || output.text || "").trim();
    ai.last.markdown = markdown;
    const heading = action === "translate"
      ? `Translation${output.language === "ko" ? " · 한국어" : output.language === "en" ? " · English" : ""}`
      : "Cleaned-up version";
    const buttons = action === "translate"
      ? aiButton("markdown-append", "Add below note", true) + aiButton("markdown-replace", "Replace note") + aiButton("copy", "Copy")
      : aiButton("markdown-replace", "Replace note", true) + aiButton("copy", "Copy");
    html = aiCard(heading, `<div class="ai-preview">${sanitizeHtml(markdownToHtml(markdown))}</div>`, buttons);
  } else if (action === "find-related") {
    const related = output.related || [];
    html = aiCard("Related notes", related.length
      ? `<ul class="ai-links">${related.map((n) => `<li><button type="button" data-ai-open-note="${Number(n.id)}">${escapeHtml(n.title || "Untitled note")}</button>${n.tags?.length ? `<span>#${n.tags.map(escapeHtml).join(" #")}</span>` : ""}</li>`).join("")}</ul>`
      : "<p>No related notes yet.</p>");
  } else if (action === "ask-note" || action === "ask-all") {
    const answer = String(output.answer || output.text || "").trim();
    const sources = output.sources || [];
    html = aiCard(ai.last.label || question, `<div class="ai-preview">${sanitizeHtml(markdownToHtml(answer))}</div>${sources.length ? `<p class="ai-sources-label">From</p><ul class="ai-links">${sources.map((s) => `<li><button type="button" data-ai-open-note="${Number(s.id)}">${escapeHtml(s.title || "Untitled note")}</button></li>`).join("")}</ul>` : ""}`,
      (ai.last.replace ? aiButton("replace-selection", "Replace selection", true) : "") + aiButton("copy", "Copy"));
    ai.last.markdown = answer;
  }

  ai.result.innerHTML = html;
}

function aiResultText() {
  const card = ai.result.querySelector(".ai-card");
  return (card?.querySelector("ul, .ai-preview, .ai-title")?.innerText || "").trim();
}

async function applyAiResult(kind) {
  const last = ai.last;
  if (!last) return;
  // Applying to a different note than the one the result came from would be
  // surprising; only the copy action is allowed then.
  if (kind !== "copy" && last.noteId && last.noteId !== state.selectedId) {
    showAiError(new Error("Open the note this result came from to apply it."));
    return;
  }

  if (kind === "copy") {
    try {
      await navigator.clipboard.writeText(aiResultText());
      flashAiNote("Copied");
    } catch {
      flashAiNote("Copy isn't available here");
    }
    return;
  }

  if (kind === "summary-top") {
    const points = aiList(last.output.summary || last.output.bullets || last.output.points || last.output.text);
    const block = `<h3>Summary</h3><ul>${points.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul><hr>`;
    setEditorHtml(block + getEditorHtml());
    noteEdited(elements.body);
  } else if (kind === "tasks-append") {
    const tasks = aiList(last.output.tasks || last.output.items || last.output.text);
    setEditorHtml(getEditorHtml() + markdownToHtml(tasks.map((t) => `- [ ] ${t}`).join("\n")));
    noteEdited(elements.body);
  } else if (kind === "tags-add") {
    const chosen = [...ai.result.querySelectorAll(".ai-tag input:checked")].map((input) => input.value);
    const merged = [...new Set([...splitTags(elements.tags.value), ...chosen])];
    elements.tags.value = merged.join(", ");
    noteEdited(elements.tags);
  } else if (kind === "title-use") {
    elements.title.value = last.title;
    noteEdited(elements.title);
  } else if (kind === "markdown-replace") {
    if (!window.confirm("Replace the whole note with this version? The current text stays in version history.")) return;
    setEditorHtml(markdownToHtml(last.markdown));
    noteEdited(elements.body);
  } else if (kind === "replace-selection") {
    const target = last.replace;
    const range = target?.range;
    if (!range || !selectionIsInEditor(range) || range.toString().trim() !== target.text) {
      showAiError(new Error("The selected text changed since you asked. Copy the answer instead."));
      return;
    }
    // Replace the range directly: execCommand("insertText") mishandles a
    // selection that spans formatting (it inserted beside bold text).
    const replacement = document.createTextNode(String(last.output.answer || last.output.text || "").trim());
    range.deleteContents();
    range.insertNode(replacement);
    const after = document.createRange();
    after.setStartAfter(replacement);
    after.collapse(true);
    elements.body.focus({ preventScroll: true });
    restoreEditorSelection(after);
    noteEdited(elements.body);
    last.replace = null;
    flashAiNote("Replaced");
    return;
  } else if (kind === "markdown-append") {
    setEditorHtml(`${getEditorHtml()}<hr>${markdownToHtml(last.markdown)}`);
    noteEdited(elements.body);
  }
  flashAiNote("Added to your note");
}

function flashAiNote(text) {
  const actions = ai.result.querySelector(".ai-card-actions");
  if (!actions) return;
  actions.querySelector(".ai-flash")?.remove();
  actions.insertAdjacentHTML("beforeend", `<span class="ai-flash" role="status">${escapeHtml(text)}</span>`);
}

if (ai.panel) {
  ai.openButton?.addEventListener("click", () => (ai.panel.hidden ? openAiPanel() : closeAiPanel()));
  ai.closeButton?.addEventListener("click", closeAiPanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !ai.panel.hidden) closeAiPanel();
  });

  ai.panel.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-ai-action]");
    if (actionButton) {
      runAiNoteAction(actionButton.dataset.aiAction);
      return;
    }
    const applyButton = event.target.closest("[data-ai-apply]");
    if (applyButton) {
      applyAiResult(applyButton.dataset.aiApply);
      return;
    }
    const noteButton = event.target.closest("[data-ai-open-note]");
    if (noteButton) openNoteById(Number(noteButton.dataset.aiOpenNote)).catch(showAiError);
  });

  ai.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = ai.question.value.trim();
    if (!question) return;
    const scope = ai.form.querySelector("input[name='ai-scope']:checked")?.value || "note";
    if (scope === "all") askAllNotesAi(question);
    else runAiNoteAction("ask-note", question);
  });

  ai.question.addEventListener("keydown", (event) => {
    // Enter asks; Shift+Enter adds a line. Leave Korean IME composition alone.
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      ai.form.requestSubmit();
    }
  });
}

// ═══ Voice notes ═══════════════════════════════════════════════════════
// Tap the mic, speak (Korean or English), tap again: the audio is
// transcribed on the server (Whisper via the AI provider) and the text is
// added to the note.
// target: "editor" (the open note) or "today" (the daily note, from Today)
const voice = { recorder: null, chunks: [], stream: null, target: "editor" };

function voiceMimeType() {
  if (!window.MediaRecorder) return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function setVoiceState(recording, label) {
  const button = voice.target === "today"
    ? document.querySelector("[data-today-voice]")
    : ai.voiceButton;
  if (!button) return;
  button.classList.toggle("is-recording", recording);
  button.setAttribute("aria-pressed", recording ? "true" : "false");
  button.title = label;
  button.setAttribute("aria-label", label);
}

async function startVoiceNote() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setStatus("Voice notes aren't supported in this browser");
    return;
  }
  try {
    voice.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    setStatus("Microphone access was blocked");
    return;
  }
  const mimeType = voiceMimeType();
  voice.chunks = [];
  voice.recorder = new MediaRecorder(voice.stream, mimeType ? { mimeType } : undefined);
  voice.recorder.addEventListener("dataavailable", (event) => { if (event.data.size) voice.chunks.push(event.data); });
  voice.recorder.addEventListener("stop", transcribeVoiceNote);
  voice.recorder.start();
  setVoiceState(true, "Stop dictating");
  setStatus("Listening… tap the mic again to stop");
}

function stopVoiceNote() {
  if (voice.recorder?.state === "recording") voice.recorder.stop();
  voice.stream?.getTracks().forEach((track) => track.stop());
  setVoiceState(false, "Dictate a voice note");
}

async function transcribeVoiceNote() {
  const type = voice.recorder?.mimeType || "audio/webm";
  const blob = new Blob(voice.chunks, { type });
  voice.recorder = null;
  if (!blob.size) return;
  const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
  const form = new FormData();
  form.append("file", blob, `voice-note.${extension}`);
  ai.voiceButton?.classList.add("is-busy");
  setStatus("Transcribing…");
  try {
    const response = await fetch("/api/ai/transcribe", { method: "POST", body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Transcription failed");
    const text = String(payload.text || "").trim();
    if (!text) {
      setStatus("No speech detected");
      return;
    }
    if (voice.target === "today") {
      await captureToToday(text, false);
      setStatus("Voice note added to today");
      return;
    }
    const paragraphs = text.split(/\n+/).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
    setEditorHtml(getEditorHtml().replace(/<p><br><\/p>$|<p><\/p>$/, "") + paragraphs);
    noteEdited(elements.body);
    setStatus("Voice note added");
  } catch (error) {
    setStatus(error.message);
  } finally {
    ai.voiceButton?.classList.remove("is-busy");
    voice.target = "editor";
  }
}

ai.voiceButton?.addEventListener("click", () => {
  if (voice.recorder?.state === "recording") stopVoiceNote();
  else { voice.target = "editor"; startVoiceNote(); }
});

// ═══ Today: quick capture, daily note, open tasks ═════════════════════
// Home is the Today page. Captures go into one note per day ("Daily note —
// 2026-11-13", tagged #daily) as timestamped lines or checklist items. Open
// tasks are gathered from every note's checklists and can be ticked here.
const today = {
  form: document.querySelector("[data-today-capture]"),
  input: document.querySelector("[data-today-capture-input]"),
  taskToggle: document.querySelector("[data-today-task-toggle]"),
  voiceButton: document.querySelector("[data-today-voice]"),
  status: document.querySelector("[data-today-capture-status]"),
  entries: document.querySelector("[data-today-entries]"),
  tasks: document.querySelector("[data-today-tasks]"),
  dailyTitle: document.querySelector("[data-today-daily-title]"),
  openDaily: document.querySelector("[data-today-open-daily]"),
  scratchpadSection: document.querySelector("[data-scratchpad-section]"),
  asTask: false,
  dailyNote: null,
  openTasks: [],
  busy: false
};

function localDateKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dailyNoteTitle(date = new Date()) {
  return `Daily note · ${localDateKey(date)}`;
}

// Daily notes created before the title change used an em dash.
function legacyDailyNoteTitle(date = new Date()) {
  return `Daily note \u2014 ${localDateKey(date)}`;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function findDailyNote() {
  const title = dailyNoteTitle();
  if (today.dailyNote?.title === title) return today.dailyNote;
  const titles = new Set([title, legacyDailyNoteTitle()]);
  let found = state.notes.find((n) => titles.has(n.title)) || allNotesCache.find((n) => titles.has(n.title)) || null;
  if (!found) {
    try {
      const payload = await requestJson(`/api/notes?q=${encodeURIComponent(localDateKey())}&limit=20&archived=all`);
      found = (payload.notes || []).find((n) => titles.has(n.title)) || null;
    } catch {
      found = null;
    }
  }
  // Rename an old-style (em dash) daily note to the current title.
  if (found && found.title !== title) {
    try {
      found = (await requestJson(`/api/notes/${found.id}`, { method: "PUT", body: JSON.stringify({ title }) })).note || found;
      // Cards and lists were drawn with the old title: update and redraw.
      for (const list of [state.notes, allNotesCache]) {
        const index = list.findIndex((n) => n.id === found.id);
        if (index >= 0) list[index] = found;
      }
      renderNotes();
      loadNotes().catch(() => {});
    } catch {
      // Keep using it under the old title; it is still today's note.
    }
  }
  today.dailyNote = found;
  return today.dailyNote;
}

function captureHtml(text, asTask) {
  return asTask
    ? markdownToHtml(`- [ ] ${text}`)
    : `<p><strong>${nowTime()}</strong> ${escapeHtml(text)}</p>`;
}

// Append HTML to today's daily note, creating the note if needed. If that
// note is open in the editor, write through the editor (autosave handles it)
// so the server copy and the open draft never diverge.
async function appendToDailyNote(html) {
  const note = await findDailyNote();
  if (note && state.selectedId === note.id) {
    setEditorHtml(getEditorHtml() + html);
    noteEdited(elements.body);
    return note;
  }
  if (note) {
    const fresh = (await requestJson(`/api/notes/${note.id}`)).note;
    const saved = (await requestJson(`/api/notes/${note.id}`, {
      method: "PUT",
      body: JSON.stringify({ body: `${fresh.body || ""}${html}`, bodyFormat: "html" })
    })).note;
    today.dailyNote = saved;
    return saved;
  }
  const created = (await requestJson("/api/notes", {
    method: "POST",
    body: JSON.stringify({ title: dailyNoteTitle(), body: html, bodyFormat: "html", tags: ["daily"], clientId: newClientId() })
  })).note;
  today.dailyNote = created;
  return created;
}

function setTodayStatus(text, isError = false) {
  if (!today.status) return;
  today.status.textContent = text;
  today.status.classList.toggle("is-error", isError);
  if (!isError && text) setTimeout(() => { if (today.status.textContent === text) today.status.textContent = ""; }, 2500);
}

async function captureToToday(text, asTask = false) {
  const clean = String(text || "").trim();
  if (!clean || today.busy) return false;
  today.busy = true;
  try {
    await appendToDailyNote(captureHtml(clean, asTask));
    today.justCaptured = true;
    setTodayStatus(asTask ? "Task added to today's note" : "Added to today's note");
    renderToday();
    return true;
  } catch (error) {
    setTodayStatus(`Couldn't save: ${error.message}`, true);
    return false;
  } finally {
    today.busy = false;
  }
}

function dailyEntriesFrom(html) {
  const root = document.createElement("div");
  root.innerHTML = sanitizeHtml(html || "");
  const entries = [];
  for (const block of root.children) {
    if (block.matches("ul, ol")) {
      block.querySelectorAll(":scope > li").forEach((li) => {
        const box = li.querySelector("input[type='checkbox']");
        entries.push({ time: "", text: li.textContent.trim(), task: Boolean(box), done: Boolean(box?.hasAttribute("checked")) });
      });
      continue;
    }
    const text = block.textContent.trim();
    if (!text) continue;
    const lead = block.firstElementChild;
    const timed = lead?.matches("strong") && /^\d{1,2}:\d{2}$/.test(lead.textContent.trim()) && block.firstChild === lead;
    entries.push(timed
      ? { time: lead.textContent.trim(), text: text.slice(lead.textContent.length).trim(), task: false, done: false }
      : { time: "", text, task: false, done: false });
  }
  return entries;
}

function renderTodayEntries() {
  if (!today.entries) return;
  const note = today.dailyNote;
  if (today.dailyTitle) {
    today.dailyTitle.textContent = `Today, ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date())}`;
  }
  if (today.openDaily) today.openDaily.hidden = !note;
  const entries = note ? dailyEntriesFrom(note.body) : [];
  if (!entries.length) {
    today.entries.innerHTML = '<li class="today-empty">Nothing yet today. Capture your first thought above and it lands here with the time.</li>';
    return;
  }
  today.entries.innerHTML = entries.map((e) => `
    <li class="today-entry${e.task ? " is-task" : ""}${e.done ? " is-done" : ""}">
      <time>${escapeHtml(e.time || (e.task ? "Task" : ""))}</time>
      <p>${escapeHtml(e.text)}</p>
    </li>`).join("");
  // Motion: a fresh capture drops into the timeline from the capture bar
  if (today.justCaptured) {
    today.justCaptured = false;
    today.entries.lastElementChild?.classList.add("is-new");
  }
}

function notebookColor(notebookId) {
  return state.notebooks.find((nb) => nb.id === notebookId)?.iconColor || "var(--ink-4)";
}

async function loadOpenTasks() {
  try {
    const payload = await requestJson("/api/notes?tasks=1&limit=100");
    const tasks = [];
    for (const note of payload.notes || []) {
      const root = document.createElement("div");
      root.innerHTML = sanitizeHtml(note.body || "");
      root.querySelectorAll("li").forEach((li, index) => {
        const box = li.querySelector("input[type='checkbox']");
        if (!box || box.hasAttribute("checked") || li.classList.contains("complete")) return;
        const text = li.textContent.trim();
        if (text) tasks.push({ noteId: note.id, title: note.title || "Untitled note", notebookId: note.notebookId, index, text });
      });
      if (tasks.length >= 12) break;
    }
    today.openTasks = tasks.slice(0, 12);
  } catch {
    today.openTasks = [];
  }
  renderTodayTasks();
}

function renderTodayTasks() {
  if (!today.tasks) return;
  if (!today.openTasks.length) {
    today.tasks.innerHTML = '<li class="today-empty">No open tasks. Checklists from any note show up here.</li>';
    return;
  }
  today.tasks.innerHTML = today.openTasks.map((t, i) => `
    <li class="today-task">
      <input type="checkbox" id="today-task-${i}" data-today-task="${i}">
      <label for="today-task-${i}">
        <span class="today-task-text">${escapeHtml(t.text)}</span>
        <button type="button" class="today-task-source" data-note-open="${Number(t.noteId)}"><span class="today-dot" style="background:${escapeHtml(notebookColor(t.notebookId))}" aria-hidden="true"></span>${escapeHtml(t.title)}</button>
      </label>
    </li>`).join("");
}

// Tick a task from Today: mark it done in its own note.
async function completeTodayTask(i) {
  const task = today.openTasks[i];
  if (!task) return;
  const mark = (root) => {
    const items = [...root.querySelectorAll("li")];
    let li = items[task.index];
    if (!li || li.textContent.trim() !== task.text) li = items.find((item) => item.textContent.trim() === task.text);
    const box = li?.querySelector("input[type='checkbox']");
    if (!box) return false;
    box.checked = true;
    box.setAttribute("checked", "");
    li.classList.add("complete");
    return true;
  };
  try {
    if (state.selectedId === task.noteId) {
      if (mark(elements.body)) noteEdited(elements.body);
    } else {
      const note = (await requestJson(`/api/notes/${task.noteId}`)).note;
      const root = document.createElement("div");
      root.innerHTML = sanitizeHtml(note.body || "");
      if (!mark(root)) throw new Error("That task changed. Refreshing.");
      await requestJson(`/api/notes/${task.noteId}`, { method: "PUT", body: JSON.stringify({ body: root.innerHTML, bodyFormat: "html" }) });
    }
    today.openTasks.splice(i, 1);
    renderTodayTasks();
    setTodayStatus("Task done");
  } catch (error) {
    setTodayStatus(error.message, true);
    loadOpenTasks();
  }
}

async function renderToday() {
  if (!elements.homeView || elements.homeView.hidden) return;
  if (today.scratchpadSection) {
    today.scratchpadSection.hidden = !(localStorage.getItem("edge_scratchpad") || "").trim();
  }
  await findDailyNote();
  renderTodayEntries();
  loadOpenTasks();
}

if (today.form) {
  today.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = today.input.value;
    if (await captureToToday(text, today.asTask)) today.input.value = "";
  });
  // Shorter placeholders on phones so they aren't cut off.
  const narrowScreen = window.matchMedia("(max-width: 660px)");
  const setCapturePlaceholder = () => {
    today.input.placeholder = today.asTask
      ? (narrowScreen.matches ? "Add a task…" : "Add a task to today…")
      : (narrowScreen.matches ? "Capture anything…" : "Capture a thought, task or idea…");
  };
  setCapturePlaceholder();
  narrowScreen.addEventListener?.("change", setCapturePlaceholder);
  today.taskToggle?.addEventListener("click", () => {
    today.asTask = !today.asTask;
    today.taskToggle.setAttribute("aria-pressed", today.asTask ? "true" : "false");
    setCapturePlaceholder();
    today.input.focus();
  });
  today.voiceButton?.addEventListener("click", () => {
    if (voice.recorder?.state === "recording") stopVoiceNote();
    else { voice.target = "today"; startVoiceNote(); }
  });
  today.openDaily?.addEventListener("click", () => {
    if (today.dailyNote) openNoteById(today.dailyNote.id);
  });
  today.tasks?.addEventListener("change", (event) => {
    const box = event.target.closest("[data-today-task]");
    if (box?.checked) completeTodayTask(Number(box.dataset.todayTask));
  });
  today.tasks?.addEventListener("click", (event) => {
    const source = event.target.closest("[data-note-open]");
    if (source) {
      event.preventDefault();
      openNoteById(Number(source.dataset.noteOpen));
    }
  });
  // Re-render Today whenever the home view is drawn.
  const originalRenderHomeView = renderHomeView;
  renderHomeView = function renderHomeViewWithToday(...args) {
    const result = originalRenderHomeView.apply(this, args);
    renderToday();
    return result;
  };
  renderToday();
}

// ═══ Command bar (⌘K) ═════════════════════════════════════════════════
// One box to search notes, run actions and ask your notes. Opened with
// ⌘K / Ctrl+K or the sidebar button. Keyboard: ↑↓ move, ↵ run, ⌘↵ new note
// with the typed title, ⌥↵ add the text to today's note, esc close.
const cmd = {
  root: document.querySelector("[data-cmd]"),
  input: document.querySelector("[data-cmd-input]"),
  list: document.querySelector("[data-cmd-list]"),
  answer: document.querySelector("[data-cmd-answer]"),
  items: [],
  active: 0,
  searchSeq: 0,
  searchTimer: null,
  notes: [],
  returnFocus: null
};

const isMacLike = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
if (!isMacLike) {
  document.querySelectorAll("[data-cmd-kbd]").forEach((kbd) => { kbd.textContent = "Ctrl K"; });
  const modHint = document.querySelector("[data-cmd-mod-hint]");
  if (modHint) modHint.textContent = "Ctrl↵ new note";
}

function looksLikeQuestion(text) {
  return /\?$|^(what|who|when|where|why|how|which|did|do|does|is|are|can|should|summari[sz]e)\b/i.test(text)
    || /(뭐|무엇|언제|어디|누가|왜|어떻게|있나요|인가요|했나요|알려줘)/.test(text);
}

function goToView(filter) {
  state.forceEditorOpen = false;
  state.tableShowArchived = false;
  state.filter = filter;
  state.notebookFilter = null;
  state.tagFilter = null;
  if (filter === "home") {
    updateNavigationState();
    renderHomeView();
    loadNotes().catch(() => {});
  } else {
    loadNotes();
  }
  setMobilePanel(filter === "home" ? "home" : "list");
}

function currentThemeIsDark() {
  const root = document.documentElement;
  return root.getAttribute("data-theme") === "dark" || root.classList.contains("system-dark");
}

function commandActions(query) {
  const q = query.trim();
  const actions = [
    { id: "new", label: q ? `New note “${q}”` : "New note", hint: isMacLike ? "⌘↵" : "Ctrl↵", icon: "plus",
      run: () => { createNewNote(); if (q) { elements.title.value = q; noteEdited(elements.title); } } },
    { id: "today-add", label: `Add “${q}” to today's note`, hint: isMacLike ? "⌥↵" : "Alt↵", icon: "sun", needsQuery: true,
      run: () => captureToToday(q).then((ok) => ok && setStatus("Added to today's note")) },
    { id: "today", label: "Go to Today", icon: "sun", keywords: "home today daily", run: () => goToView("home") },
    { id: "all", label: "Go to all notes", icon: "notes", keywords: "notes list all", run: () => goToView("all") },
    { id: "voice", label: "Dictate a voice note into today", icon: "mic", keywords: "voice dictate record speech 음성",
      run: () => { goToView("home"); voice.target = "today"; startVoiceNote(); } },
    { id: "theme", label: currentThemeIsDark() ? "Switch to light mode" : "Switch to dark mode", icon: "moon", keywords: "theme dark light mode",
      run: () => document.querySelector(`[data-theme-set="${currentThemeIsDark() ? "light" : "dark"}"]`)?.click() }
  ];
  if (!q) return actions.filter((a) => !a.needsQuery && a.id !== "new").concat(actions.filter((a) => a.id === "new"));
  const lower = q.toLowerCase();
  return actions.filter((a) => a.id === "new" || a.id === "today-add"
    || a.label.toLowerCase().includes(lower) || (a.keywords || "").includes(lower));
}

const cmdIcons = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  notes: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  ask: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>'
};

function highlightMatch(text, query) {
  const safe = escapeHtml(text);
  const q = query.trim();
  if (!q) return safe;
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index < 0) return safe;
  return `${escapeHtml(text.slice(0, index))}<mark>${escapeHtml(text.slice(index, index + q.length))}</mark>${escapeHtml(text.slice(index + q.length))}`;
}

function noteSnippet(note, query) {
  const text = stripHtml(note.body || "");
  const q = query.trim().toLowerCase();
  const at = q ? text.toLowerCase().indexOf(q) : -1;
  if (at < 0) return text.slice(0, 110);
  const start = Math.max(0, at - 36);
  return `${start ? "…" : ""}${text.slice(start, start + 120)}`;
}

function buildCommandItems() {
  const q = cmd.input.value.trim();
  const items = [];
  const askItem = q ? [{ kind: "ask", label: `Ask your notes: “${q}”`, icon: "ask" }] : [];
  const noteItems = cmd.notes.slice(0, 6).map((note) => ({ kind: "note", note }));
  const questionFirst = q && looksLikeQuestion(q);

  if (questionFirst) items.push({ heading: "Ask" }, ...askItem);
  if (noteItems.length) items.push({ heading: q ? "Notes" : "Recent notes" }, ...noteItems);
  if (q && !questionFirst) items.push({ heading: "Ask" }, ...askItem);
  const actions = commandActions(q).map((a) => ({ kind: "action", ...a }));
  if (actions.length) items.push({ heading: "Actions" }, ...actions);

  cmd.items = items.filter((item) => !item.heading);
  cmd.active = Math.min(cmd.active, Math.max(cmd.items.length - 1, 0));
  let optionIndex = -1;
  cmd.list.innerHTML = items.map((item) => {
    if (item.heading) return `<li class="cmd-heading" role="presentation">${escapeHtml(item.heading)}</li>`;
    optionIndex += 1;
    const id = `cmd-opt-${optionIndex}`;
    const selected = optionIndex === cmd.active;
    if (item.kind === "note") {
      const n = item.note;
      return `<li id="${id}" class="cmd-item cmd-note" role="option" aria-selected="${selected}" data-cmd-index="${optionIndex}">
        <span class="cmd-dot" style="background:${escapeHtml(notebookColor(n.notebookId))}" aria-hidden="true"></span>
        <span class="cmd-text"><strong>${highlightMatch(n.title || "Untitled note", q)}</strong><span>${highlightMatch(noteSnippet(n, q), q)}</span></span>
        <span class="cmd-meta">${escapeHtml(n.notebookName || (n.tags?.[0] ? `#${n.tags[0]}` : ""))}</span>
      </li>`;
    }
    return `<li id="${id}" class="cmd-item cmd-${item.kind}" role="option" aria-selected="${selected}" data-cmd-index="${optionIndex}">
      <span class="cmd-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${cmdIcons[item.icon] || ""}</svg></span>
      <span class="cmd-text"><strong>${escapeHtml(item.label)}</strong></span>
      ${item.hint ? `<kbd class="cmd-hint">${escapeHtml(item.hint)}</kbd>` : ""}
    </li>`;
  }).join("");
  cmd.input.setAttribute("aria-activedescendant", cmd.items.length ? `cmd-opt-${cmd.active}` : "");
}

function moveCommandSelection(delta) {
  if (!cmd.items.length) return;
  cmd.active = (cmd.active + delta + cmd.items.length) % cmd.items.length;
  cmd.list.querySelectorAll("[data-cmd-index]").forEach((el) => {
    el.setAttribute("aria-selected", String(Number(el.dataset.cmdIndex) === cmd.active));
  });
  cmd.input.setAttribute("aria-activedescendant", `cmd-opt-${cmd.active}`);
  document.getElementById(`cmd-opt-${cmd.active}`)?.scrollIntoView({ block: "nearest" });
}

function recentNotesForCommand() {
  const pool = (allNotesCache.length ? allNotesCache : state.notes).slice();
  return pool.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 5);
}

function searchCommandNotes() {
  const q = cmd.input.value.trim();
  clearTimeout(cmd.searchTimer);
  cmd.answer.hidden = true;
  if (!q) {
    cmd.notes = recentNotesForCommand();
    cmd.active = 0;
    buildCommandItems();
    return;
  }
  // Instant local matches first, then the server's full search.
  const lower = q.toLowerCase();
  cmd.notes = (allNotesCache.length ? allNotesCache : state.notes)
    .filter((n) => `${n.title} ${stripHtml(n.body || "")} ${(n.tags || []).join(" ")}`.toLowerCase().includes(lower))
    .slice(0, 6);
  cmd.active = 0;
  buildCommandItems();
  const seq = ++cmd.searchSeq;
  cmd.searchTimer = setTimeout(async () => {
    try {
      const payload = await requestJson(`/api/notes?q=${encodeURIComponent(q)}&limit=6&archived=active`);
      if (seq !== cmd.searchSeq || cmd.root.hidden) return;
      cmd.notes = payload.notes || [];
      buildCommandItems();
    } catch {
      // Offline: keep the local matches.
    }
  }, 160);
}

async function askFromCommand(question) {
  cmd.answer.hidden = false;
  cmd.answer.innerHTML = '<div class="cmd-answer-loading"><span class="ai-spinner" aria-hidden="true"></span>Searching your notes…</div>';
  try {
    const payload = await requestJson("/api/ai/ask", { method: "POST", body: JSON.stringify({ question }) });
    const sources = payload.sources || [];
    cmd.answer.innerHTML = `
      <p class="cmd-answer-label"><svg viewBox="0 0 24 24" aria-hidden="true">${cmdIcons.ask}</svg>Answer</p>
      <div class="cmd-answer-text">${sanitizeHtml(markdownToHtml(String(payload.answer || "")))}</div>
      ${sources.length ? `<p class="cmd-answer-label">From</p><div class="cmd-sources">${sources.map((src) => `<button type="button" data-cmd-open-note="${Number(src.id)}">${escapeHtml(src.title || "Untitled note")}</button>`).join("")}</div>` : ""}`;
  } catch (error) {
    cmd.answer.innerHTML = `<div class="ai-error"><strong>Couldn't answer that.</strong><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function runCommandItem(item, { modifier = false, alt = false } = {}) {
  const q = cmd.input.value.trim();
  if (modifier) item = { kind: "action", ...commandActions(q).find((a) => a.id === "new") };
  if (alt && q) item = { kind: "action", ...commandActions(q).find((a) => a.id === "today-add") };
  if (!item) return;
  if (item.kind === "ask") {
    askFromCommand(q);
    return;
  }
  closeCommandBar({ restoreFocus: false });
  if (item.kind === "note") {
    await openNoteById(item.note.id);
    return;
  }
  await item.run?.();
}

function openCommandBar() {
  if (!cmd.root) return;
  cmd.returnFocus = document.activeElement;
  cmd.root.hidden = false;
  document.body.classList.add("cmd-open");
  cmd.input.value = "";
  cmd.answer.hidden = true;
  cmd.active = 0;
  searchCommandNotes();
  requestAnimationFrame(() => cmd.input.focus());
}

function closeCommandBar({ restoreFocus = true } = {}) {
  if (!cmd.root || cmd.root.hidden) return;
  cmd.root.hidden = true;
  document.body.classList.remove("cmd-open");
  clearTimeout(cmd.searchTimer);
  if (restoreFocus) cmd.returnFocus?.focus?.();
}

function toggleCommandBar() {
  if (cmd.root?.hidden) openCommandBar();
  else closeCommandBar();
}

if (cmd.root) {
  document.querySelectorAll("[data-cmd-open]").forEach((button) => button.addEventListener("click", openCommandBar));
  cmd.root.querySelector("[data-cmd-close]")?.addEventListener("click", () => closeCommandBar());
  cmd.root.addEventListener("mousedown", (event) => {
    if (event.target === cmd.root) closeCommandBar();
  });
  cmd.input.addEventListener("input", searchCommandNotes);
  cmd.input.addEventListener("keydown", (event) => {
    if (event.isComposing || event.keyCode === 229) return; // Korean IME composing
    // Keys the command bar handles must not also reach the app's global
    // shortcuts (⌘↵ would otherwise insert a checklist item in the editor).
    if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) event.stopPropagation();
    if (event.key === "ArrowDown") { event.preventDefault(); moveCommandSelection(1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); moveCommandSelection(-1); }
    else if (event.key === "Escape") { event.preventDefault(); closeCommandBar(); }
    else if (event.key === "Enter") {
      event.preventDefault();
      runCommandItem(cmd.items[cmd.active], { modifier: event.metaKey || event.ctrlKey, alt: event.altKey });
    }
  });
  cmd.list.addEventListener("mousemove", (event) => {
    const option = event.target.closest("[data-cmd-index]");
    if (option && Number(option.dataset.cmdIndex) !== cmd.active) {
      cmd.active = Number(option.dataset.cmdIndex);
      moveCommandSelection(0);
    }
  });
  cmd.list.addEventListener("click", (event) => {
    const option = event.target.closest("[data-cmd-index]");
    if (option) runCommandItem(cmd.items[Number(option.dataset.cmdIndex)]);
  });
  cmd.answer.addEventListener("click", (event) => {
    const source = event.target.closest("[data-cmd-open-note]");
    if (source) {
      closeCommandBar({ restoreFocus: false });
      openNoteById(Number(source.dataset.cmdOpenNote));
    }
  });
  // Esc works even when focus has left the input.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !cmd.root.hidden) closeCommandBar();
  });
}

// ═══ Context panel: Linked · Outline · Assistant ═══════════════════════
const ctx = {
  tabs: [...document.querySelectorAll("[data-ctx-tab]")],
  panels: [...document.querySelectorAll("[data-ctx-panel]")],
  linked: document.querySelector("[data-ctx-linked]"),
  outline: document.querySelector("[data-ctx-outline]"),
  current: readCache("edge_ctx_tab", "assistant"),
  linkSeq: 0,
  outlineTimer: null
};

function selectContextTab(tab) {
  if (!ctx.tabs.length) return;
  ctx.current = ["linked", "outline", "assistant"].includes(tab) ? tab : "assistant";
  writeCache("edge_ctx_tab", ctx.current);
  ctx.tabs.forEach((button) => button.setAttribute("aria-selected", String(button.dataset.ctxTab === ctx.current)));
  ctx.panels.forEach((panel) => { panel.hidden = panel.dataset.ctxPanel !== ctx.current; });
  refreshContext();
}

function refreshContext() {
  if (!ai.panel || ai.panel.hidden) return;
  if (ctx.current === "linked") refreshLinked();
  else if (ctx.current === "outline") renderOutline();
  else loadAiStatus();
}

// Text around a link or mention, for a one-line preview.
function contextSnippet(text, needle, radius = 70) {
  const at = text.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return { before: text.slice(0, radius * 2), hit: "", after: "" };
  const start = Math.max(0, at - radius);
  return {
    before: `${start ? "…" : ""}${text.slice(start, at)}`,
    hit: text.slice(at, at + needle.length),
    after: `${text.slice(at + needle.length, at + needle.length + radius)}${at + needle.length + radius < text.length ? "…" : ""}`
  };
}

async function refreshLinked() {
  if (!ctx.linked) return;
  const id = state.selectedId;
  if (!id) {
    ctx.linked.innerHTML = '<p class="ctx-empty">Save this note to see which notes link to it.</p>';
    return;
  }
  const title = String(currentNote()?.title || elements.title.value || "").trim();
  const seq = ++ctx.linkSeq;
  ctx.linked.innerHTML = '<div class="ai-loading"><span class="ai-spinner" aria-hidden="true"></span>Finding links…</div>';
  const marker = `data-note-link="${id}"`;
  const [linkedRes, mentionRes] = await Promise.all([
    requestJson(`/api/notes?q=${encodeURIComponent(marker)}&limit=30&archived=all`).catch(() => ({ notes: [] })),
    title.length >= 4 && title !== "Untitled note"
      ? requestJson(`/api/notes?q=${encodeURIComponent(title)}&limit=30`).catch(() => ({ notes: [] }))
      : Promise.resolve({ notes: [] })
  ]);
  if (seq !== ctx.linkSeq || state.selectedId !== id) return;

  const linked = (linkedRes.notes || []).filter((n) => n.id !== id && String(n.body || "").includes(marker));
  const linkedIds = new Set(linked.map((n) => n.id));
  const mentioned = (mentionRes.notes || []).filter((n) => n.id !== id && !linkedIds.has(n.id)
    && stripHtml(n.body || "").toLowerCase().includes(title.toLowerCase()));

  const linkedCards = linked.map((n) => {
    const root = document.createElement("div");
    root.innerHTML = sanitizeHtml(n.body || "");
    const link = root.querySelector(`span.note-link[data-note-link="${id}"]`);
    const block = link?.closest("p, li, h2, h3, h4, blockquote, td") || link?.parentElement;
    const text = (block?.textContent || stripHtml(n.body || "")).replace(/\s+/g, " ").trim();
    const snip = contextSnippet(text, link?.textContent || title);
    return `<button type="button" class="ctx-card" data-note-open="${Number(n.id)}">
      <strong><span class="today-dot" style="background:${escapeHtml(notebookColor(n.notebookId))}" aria-hidden="true"></span>${escapeHtml(n.title || "Untitled note")}</strong>
      <span>${escapeHtml(snip.before)}<mark class="ctx-hit">${escapeHtml(snip.hit)}</mark>${escapeHtml(snip.after)}</span>
    </button>`;
  }).join("");

  const mentionCards = mentioned.slice(0, 8).map((n) => {
    const snip = contextSnippet(stripHtml(n.body || "").replace(/\s+/g, " "), title, 50);
    return `<button type="button" class="ctx-card is-unlinked" data-note-open="${Number(n.id)}">
      <strong>${escapeHtml(n.title || "Untitled note")}</strong>
      <span>${escapeHtml(snip.before)}<mark class="ctx-hit">${escapeHtml(snip.hit)}</mark>${escapeHtml(snip.after)}</span>
    </button>`;
  }).join("");

  ctx.linked.innerHTML = `
    <p class="ctx-label">Linked from ${linked.length} ${linked.length === 1 ? "note" : "notes"}</p>
    ${linked.length ? linkedCards : '<p class="ctx-empty">No note links here yet. Type @ in any note to link to this one.</p>'}
    ${mentioned.length ? `<p class="ctx-label">Mentioned but not linked</p>${mentionCards}` : ""}`;
}

function outlineHeadings() {
  return [...elements.body.querySelectorAll("h2, h3, h4")].filter((h) => h.textContent.trim());
}

function renderOutline() {
  if (!ctx.outline) return;
  const heads = outlineHeadings();
  ctx.outline.innerHTML = heads.length
    ? heads.map((h, i) => `<li class="ctx-outline-item level-${h.tagName.slice(1)}"><button type="button" data-outline-index="${i}">${escapeHtml(h.textContent.trim())}</button></li>`).join("")
    : '<li class="ctx-empty">No headings yet. Type /heading to add one.</li>';
}

function jumpToHeading(index) {
  const heading = outlineHeadings()[index];
  if (!heading) return;
  heading.scrollIntoView({ behavior: "smooth", block: "center" });
  const range = document.createRange();
  range.selectNodeContents(heading);
  range.collapse(false);
  elements.body.focus({ preventScroll: true });
  restoreEditorSelection(range);
}

if (ai.panel && ctx.tabs.length) {
  ctx.tabs.forEach((button) => button.addEventListener("click", () => selectContextTab(button.dataset.ctxTab)));
  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  ai.panel.querySelector("[role='tablist']")?.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const order = ctx.tabs.map((b) => b.dataset.ctxTab);
    const next = order[(order.indexOf(ctx.current) + (event.key === "ArrowRight" ? 1 : order.length - 1)) % order.length];
    selectContextTab(next);
    ctx.tabs.find((b) => b.dataset.ctxTab === next)?.focus();
  });
  ctx.linked?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-note-open]");
    if (card) openNoteById(Number(card.dataset.noteOpen));
  });
  ctx.outline?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-outline-index]");
    if (item) jumpToHeading(Number(item.dataset.outlineIndex));
  });
  elements.body.addEventListener("input", () => {
    if (ai.panel.hidden || ctx.current !== "outline") return;
    clearTimeout(ctx.outlineTimer);
    ctx.outlineTimer = setTimeout(renderOutline, 250);
  });

  const originalOpenAiPanel = openAiPanel;
  openAiPanel = function openContextPanel(...args) {
    const result = originalOpenAiPanel.apply(this, args);
    selectContextTab(ctx.current);
    return result;
  };
  selectContextTab(ctx.current);
}

// ═══ Slash menu ═══════════════════════════════════════════════════════
// Type "/" at the start of a line (or after a space) for blocks, inserts and
// AI actions. Filters as you type; ↑↓ / Enter / Tab / Esc, or click.
const slash = { menu: null, open: false, node: null, offset: 0, query: "", items: [], active: 0 };

function openAssistantAction(action) {
  openAiPanel();
  selectContextTab("assistant");
  runAiNoteAction(action);
}

const slashCommands = [
  { group: "Blocks", id: "h2", label: "Heading", hint: "Section heading", keys: "heading h2 title 제목", icon: "H", run: (c) => convertSlashBlock(c.origin, "h2") },
  { group: "Blocks", id: "h3", label: "Subheading", hint: "Smaller heading", keys: "subheading h3", icon: "h", run: (c) => convertSlashBlock(c.origin, "h3") },
  { group: "Blocks", id: "task", label: "Task list", hint: "Checkboxes", keys: "task todo checklist checkbox 할일", icon: "☐", run: () => applyWysiwygFormat("checklist") },
  { group: "Blocks", id: "bullet", label: "Bulleted list", keys: "bullet list ul", icon: "•", run: () => applyWysiwygFormat("bullet") },
  { group: "Blocks", id: "ordered", label: "Numbered list", keys: "numbered ordered ol", icon: "1.", run: () => applyWysiwygFormat("ordered") },
  { group: "Blocks", id: "quote", label: "Quote", keys: "quote blockquote", icon: "❝", run: (c) => convertSlashBlock(c.origin, "blockquote") },
  { group: "Blocks", id: "code", label: "Code block", keys: "code pre snippet", icon: "{ }", run: (c) => convertSlashBlock(c.origin, "pre") },
  { group: "Blocks", id: "text", label: "Plain text", keys: "text paragraph p", icon: "T", run: (c) => convertSlashBlock(c.origin, "p") },
  { group: "Insert", id: "table", label: "Table", keys: "table grid 표", icon: "▦", run: () => applyWysiwygFormat("table") },
  { group: "Insert", id: "divider", label: "Divider", keys: "divider hr line rule", icon: "hr", run: (c) => insertDividerAt(c.origin) },
  { group: "Insert", id: "image", label: "Image", keys: "image photo picture 사진", icon: "▣", run: () => applyWysiwygFormat("image") },
  { group: "Insert", id: "link", label: "Link to note", hint: "Type a note name", keys: "link note mention @ backlink", icon: "@",
    run: () => { document.execCommand("insertText", false, "@"); handleMentionInput(); } },
  { group: "Insert", id: "voice", label: "Voice note", hint: "Dictate here", keys: "voice dictate record audio speech 음성", icon: "mic",
    run: () => { voice.target = "editor"; startVoiceNote(); } },
  { group: "Assistant", id: "ai-summary", label: "Summarize note", keys: "ai summarize summary 요약", icon: "ai", run: () => openAssistantAction("summarize") },
  { group: "Assistant", id: "ai-tasks", label: "Find action items", keys: "ai tasks action items todo", icon: "ai", run: () => openAssistantAction("extract-tasks") },
  { group: "Assistant", id: "ai-translate", label: "Translate KO ⇄ EN", keys: "ai translate korean english 번역", icon: "ai", run: () => openAssistantAction("translate") },
  { group: "Assistant", id: "ai-title", label: "Suggest a title", keys: "ai title name", icon: "ai", run: () => openAssistantAction("create-title") }
];

// Turn the line the "/command" was typed on into another block type and put
// the caret inside it. (The toolbar's converter loses the caret on an empty
// line, which is exactly what is left after the command text is removed.)
function convertSlashBlock(origin, tag) {
  const block = origin?.isConnected ? origin : null;
  const replacement = document.createElement(tag);
  if (block && block.tagName.toLowerCase() !== tag) {
    replacement.innerHTML = block.innerHTML.trim() ? block.innerHTML : "<br>";
    block.replaceWith(replacement);
  } else if (block) {
    if (!block.innerHTML.trim()) block.innerHTML = "<br>";
    placeCaretAtStart(block);
    return;
  } else {
    replacement.innerHTML = "<br>";
    elements.body.appendChild(replacement);
  }
  placeCaretAtStart(replacement);
}

// A divider replaces the empty "/divider" line (or follows a non-empty one),
// with a fresh paragraph after it for the caret.
function insertDividerAt(origin) {
  const hr = document.createElement("hr");
  const next = document.createElement("p");
  next.innerHTML = "<br>";
  if (origin?.isConnected && !origin.textContent.trim()) origin.replaceWith(hr, next);
  else if (origin?.isConnected) origin.after(hr, next);
  else elements.body.append(hr, next);
  placeCaretAtStart(next);
}

function placeCaretAtStart(element) {
  const range = document.createRange();
  range.setStart(element, 0);
  range.collapse(true);
  elements.body.focus({ preventScroll: true });
  restoreEditorSelection(range);
  saveSelection();
}

function slashMenuElement() {
  if (slash.menu) return slash.menu;
  slash.menu = document.createElement("div");
  slash.menu.className = "slash-menu";
  slash.menu.id = "slash-menu";
  slash.menu.setAttribute("role", "listbox");
  slash.menu.setAttribute("aria-label", "Insert block");
  slash.menu.hidden = true;
  document.body.appendChild(slash.menu);
  // Keep the editor caret while clicking the menu.
  slash.menu.addEventListener("mousedown", (event) => event.preventDefault());
  slash.menu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-slash-index]");
    if (option) runSlashCommand(Number(option.dataset.slashIndex));
  });
  slash.menu.addEventListener("mousemove", (event) => {
    const option = event.target.closest("[data-slash-index]");
    if (option && Number(option.dataset.slashIndex) !== slash.active) {
      slash.active = Number(option.dataset.slashIndex);
      paintSlashSelection();
    }
  });
  return slash.menu;
}

function filterSlashCommands(query) {
  const q = query.trim().toLowerCase();
  if (!q) return slashCommands;
  return slashCommands.filter((c) => c.label.toLowerCase().includes(q) || c.keys.includes(q));
}

function slashIcon(icon) {
  if (icon === "ai") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>';
  if (icon === "hr") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"/></svg>';
  if (icon === "mic") return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/></svg>';
  return `<span aria-hidden="true">${escapeHtml(icon)}</span>`;
}

function renderSlashMenu() {
  const menu = slashMenuElement();
  let group = "";
  menu.innerHTML = slash.items.map((item, index) => {
    const heading = item.group !== group ? `<div class="slash-group" role="presentation">${escapeHtml(item.group)}</div>` : "";
    group = item.group;
    return `${heading}<div class="slash-item${item.icon === "ai" ? " is-ai" : ""}" role="option" id="slash-opt-${index}" aria-selected="${index === slash.active}" data-slash-index="${index}">
      <span class="slash-icon">${slashIcon(item.icon)}</span>
      <span class="slash-label">${escapeHtml(item.label)}${item.hint ? `<small>${escapeHtml(item.hint)}</small>` : ""}</span>
    </div>`;
  }).join("");
  elements.body.setAttribute("aria-activedescendant", `slash-opt-${slash.active}`);
}

function paintSlashSelection() {
  slash.menu?.querySelectorAll("[data-slash-index]").forEach((el) => {
    el.setAttribute("aria-selected", String(Number(el.dataset.slashIndex) === slash.active));
  });
  document.getElementById(`slash-opt-${slash.active}`)?.scrollIntoView({ block: "nearest" });
  elements.body.setAttribute("aria-activedescendant", `slash-opt-${slash.active}`);
}

function positionSlashMenu() {
  const menu = slashMenuElement();
  const range = document.createRange();
  try {
    range.setStart(slash.node, slash.offset);
    range.setEnd(slash.node, Math.min(slash.offset + 1, slash.node.length));
  } catch {
    return;
  }
  const rect = range.getBoundingClientRect();
  const width = menu.offsetWidth || 300;
  const height = menu.offsetHeight || 320;
  const below = rect.bottom + 8;
  const top = below + height > window.innerHeight - 12 ? Math.max(12, rect.top - height - 8) : below;
  menu.style.top = `${top}px`;
  menu.style.left = `${Math.min(Math.max(12, rect.left), window.innerWidth - width - 12)}px`;
}

function openSlashMenu(node, offset) {
  slash.open = true;
  slash.node = node;
  slash.offset = offset;
  slash.query = "";
  slash.active = 0;
  slash.items = filterSlashCommands("");
  const menu = slashMenuElement();
  renderSlashMenu();
  menu.hidden = false;
  elements.body.setAttribute("aria-controls", "slash-menu");
  elements.body.setAttribute("aria-expanded", "true");
  positionSlashMenu();
}

function closeSlashMenu() {
  if (!slash.open) return;
  slash.open = false;
  if (slash.menu) slash.menu.hidden = true;
  elements.body.removeAttribute("aria-activedescendant");
  elements.body.setAttribute("aria-expanded", "false");
}

function updateSlashQuery() {
  const sel = window.getSelection();
  const node = sel?.anchorNode;
  if (!sel?.isCollapsed || node !== slash.node || sel.anchorOffset <= slash.offset || node.data?.[slash.offset] !== "/") {
    closeSlashMenu();
    return;
  }
  const query = node.data.slice(slash.offset + 1, sel.anchorOffset);
  if (query.length > 24 || /^\s|\s\s/.test(query)) {
    closeSlashMenu();
    return;
  }
  slash.query = query;
  slash.items = filterSlashCommands(query);
  if (!slash.items.length) {
    if (query.length > 3) closeSlashMenu();
    else { slash.menu.innerHTML = '<div class="slash-empty">No matches</div>'; }
    return;
  }
  slash.active = Math.min(slash.active, slash.items.length - 1);
  renderSlashMenu();
  positionSlashMenu();
}

function runSlashCommand(index) {
  const item = slash.items[index];
  if (!item) return;
  const node = slash.node;
  const sel = window.getSelection();
  const end = sel?.anchorNode === node ? sel.anchorOffset : slash.offset + 1 + slash.query.length;
  closeSlashMenu();
  // Remove the "/query" text, then run the command at that spot.
  const range = document.createRange();
  range.setStart(node, slash.offset);
  range.setEnd(node, Math.min(end, node.length));
  // The line the command was typed on. After a list, the editor's own
  // Enter handling makes that line a <div>, so divs count (not the editor).
  let origin = node.parentElement?.closest("p, div, h2, h3, h4, blockquote, pre");
  if (origin === elements.body || !elements.body.contains(origin)) origin = null;
  range.deleteContents();
  range.collapse(true);
  if (origin && !origin.textContent.trim() && !origin.querySelector("img, table, input, hr")) {
    // An empty text node is not a real caret position (Chrome moves the
    // caret elsewhere); give the line a <br> and put the caret at its start.
    origin.innerHTML = "<br>";
    range.setStart(origin, 0);
    range.collapse(true);
  }
  elements.body.focus({ preventScroll: true });
  restoreEditorSelection(range);
  saveSelection();
  item.run({ origin });
  // Inserts like a task list or table go after the current line; if that
  // line only held "/command", don't leave an empty paragraph behind.
  if (origin?.isConnected && !origin.textContent.trim()
      && !origin.querySelector("img, table, input, hr")
      && !origin.contains(window.getSelection()?.anchorNode)) {
    origin.remove();
  }
  noteEdited(elements.body);
}

if (elements.body) {
  elements.body.addEventListener("input", (event) => {
    if (slash.open) {
      updateSlashQuery();
      return;
    }
    // Usually "/" arrives alone, but some keyboards (and pastes) commit a
    // whole chunk like "/task" at once: open for any insert starting with "/".
    if (event.inputType !== "insertText" || !event.data?.startsWith("/") || /\s/.test(event.data)) return;
    const sel = window.getSelection();
    const node = sel?.anchorNode;
    if (!sel?.isCollapsed || node?.nodeType !== Node.TEXT_NODE) return;
    const at = sel.anchorOffset - event.data.length;
    if (at < 0 || node.data[at] !== "/") return;
    const before = at > 0 ? node.data[at - 1] : "";
    if (event.data.length > 1) queueMicrotask(updateSlashQuery);
    // Only at a line start or after whitespace, so "and/or" and URLs don't open it.
    if (at === 0 || /\s| /.test(before)) openSlashMenu(node, at);
  });
  elements.body.addEventListener("keydown", (event) => {
    if (!slash.open || event.isComposing || event.keyCode === 229) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      const n = slash.items.length || 1;
      slash.active = (slash.active + (event.key === "ArrowDown" ? 1 : n - 1)) % n;
      paintSlashSelection();
    } else if (event.key === "Enter" || event.key === "Tab") {
      if (!slash.items.length) return;
      event.preventDefault();
      event.stopPropagation();
      runSlashCommand(slash.active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeSlashMenu();
    }
  }, true);
  elements.body.addEventListener("blur", () => setTimeout(closeSlashMenu, 120));
  window.addEventListener("resize", () => slash.open && positionSlashMenu());
}

// ═══ Selection bar ════════════════════════════════════════════════════
// Select text in a note: a small dark bar offers formatting and Ask AI
// (explain, rewrite, translate). Desktop only; phones keep the toolbar row.
const selBar = { el: null, menu: null, range: null, text: "", frame: 0 };
const desktopEditor = window.matchMedia("(min-width: 661px)");

function selectionBarElement() {
  if (selBar.el) return selBar.el;
  const el = document.createElement("div");
  el.className = "sel-bar";
  el.setAttribute("role", "toolbar");
  el.setAttribute("aria-label", "Format selection");
  el.hidden = true;
  el.innerHTML = `
    <button type="button" data-sel="bold" aria-label="Bold" title="Bold"><b>B</b></button>
    <button type="button" data-sel="italic" aria-label="Italic" title="Italic"><i>I</i></button>
    <button type="button" data-sel="link" aria-label="Link" title="Link"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg></button>
    <button type="button" data-sel="highlight" aria-label="Highlight" title="Highlight"><span class="sel-swatch" aria-hidden="true"></span></button>
    <button type="button" data-sel="heading" aria-label="Heading" title="Heading">H</button>
    <span class="sel-sep" aria-hidden="true"></span>
    <button type="button" class="sel-ai" data-sel="ai" aria-haspopup="menu" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>Ask AI</button>
    <div class="sel-menu" role="menu" hidden>
      <button type="button" role="menuitem" data-sel-ai="explain">Explain this</button>
      <button type="button" role="menuitem" data-sel-ai="rewrite">Rewrite more clearly</button>
      <button type="button" role="menuitem" data-sel-ai="translate">Translate KO ⇄ EN</button>
      <button type="button" role="menuitem" data-sel-ai="ask">Ask about this…</button>
    </div>`;
  document.body.appendChild(el);
  selBar.el = el;
  selBar.menu = el.querySelector(".sel-menu");
  el.addEventListener("mousedown", (event) => event.preventDefault()); // keep the selection
  el.addEventListener("click", (event) => {
    const aiChoice = event.target.closest("[data-sel-ai]");
    if (aiChoice) return runSelectionAi(aiChoice.dataset.selAi);
    const button = event.target.closest("[data-sel]");
    if (button) runSelectionFormat(button.dataset.sel);
  });
  return el;
}

function hideSelectionBar() {
  if (!selBar.el) return;
  selBar.el.hidden = true;
  selBar.menu.hidden = true;
  selBar.el.querySelector(".sel-ai")?.setAttribute("aria-expanded", "false");
}

function updateSelectionBar() {
  const sel = window.getSelection();
  const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
  if (!desktopEditor.matches || slash.open || !range || range.collapsed || !selectionIsInEditor(range) || !sel.toString().trim()) {
    hideSelectionBar();
    return;
  }
  const el = selectionBarElement();
  selBar.range = range.cloneRange();
  selBar.text = sel.toString().trim();
  el.hidden = false;
  const rect = range.getBoundingClientRect();
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  let top = rect.top - height - 10;
  if (top < 8) top = rect.bottom + 10;
  el.style.top = `${top}px`;
  el.style.left = `${Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8)}px`;
}

function runSelectionFormat(kind) {
  if (selBar.range) restoreEditorSelection(selBar.range);
  saveSelection();
  if (kind === "highlight") applyToolbarColor("backgroundColor", "#ffe58a");
  else if (kind === "heading") applyToolbarSelect("block", "h2");
  else applyWysiwygFormat(kind);
  noteEdited(elements.body);
  requestAnimationFrame(updateSelectionBar);
}

function runSelectionAi(kind) {
  if (kind === undefined) return;
  const text = selBar.text.slice(0, 700);
  const range = selBar.range?.cloneRange();
  hideSelectionBar();
  if (!text) return;
  if (kind === "ask") {
    openAiPanel();
    selectContextTab("assistant");
    ai.question.value = `About "${text.slice(0, 200)}": `;
    ai.question.focus();
    ai.question.setSelectionRange(ai.question.value.length, ai.question.value.length);
    return;
  }
  const prompts = {
    explain: { label: "Explanation", question: `Explain this passage simply and briefly: "${text}"` },
    rewrite: { label: "Rewritten", question: `Rewrite this passage more clearly. Keep its meaning and its language. Reply with only the rewritten passage: "${text}"`, replace: true },
    translate: { label: "Translation", question: `Translate this passage: Korean into English, or English into Korean. Reply with only the translation: "${text}"`, replace: true }
  };
  const chosen = prompts[kind];
  openAiPanel();
  selectContextTab("assistant");
  runAiNoteAction("ask-note", chosen.question, { label: chosen.label, replace: chosen.replace && range ? { range, text: range.toString().trim() } : null });
}

document.addEventListener("selectionchange", () => {
  // A short timer (not requestAnimationFrame, which pauses in background
  // windows) coalesces the burst of events a drag-select produces.
  clearTimeout(selBar.frame);
  selBar.frame = setTimeout(updateSelectionBar, 30);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && selBar.el && !selBar.el.hidden) hideSelectionBar();
});
document.addEventListener("click", (event) => {
  const toggle = event.target.closest(".sel-ai");
  if (toggle && selBar.menu) {
    const open = selBar.menu.hidden;
    selBar.menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  }
});
elements.editorPanel?.addEventListener("scroll", () => selBar.el && !selBar.el.hidden && updateSelectionBar(), true);

// ═══ Classic toolbar toggle ═══════════════════════════════════════════
// The fixed formatting toolbar is hidden on desktop by default ("/" and the
// selection bar replace it); "Aa" in the editor header brings it back.
const toolbarToggle = document.querySelector("[data-toolbar-toggle]");
function applyToolbarPreference() {
  const show = localStorage.getItem("edge_toolbar") === "show";
  document.body.classList.toggle("toolbar-hidden", !show);
  if (toolbarToggle) {
    toolbarToggle.setAttribute("aria-pressed", String(show));
    toolbarToggle.setAttribute("aria-label", show ? "Hide formatting toolbar" : "Show formatting toolbar");
  }
}
toolbarToggle?.addEventListener("click", () => {
  try {
    localStorage.setItem("edge_toolbar", localStorage.getItem("edge_toolbar") === "show" ? "hide" : "show");
  } catch {
    // storage unavailable: toggle for this session only
  }
  applyToolbarPreference();
});
applyToolbarPreference();

// Note switches: close transient UI and refresh the context panel.
{
  const originalSelectNote = selectNote;
  selectNote = function selectNoteWithContext(...args) {
    closeSlashMenu();
    hideSelectionBar();
    const previousId = state.selectedId;
    const result = originalSelectNote.apply(this, args);
    refreshContext();
    // Motion: a different note rises onto the page
    const page = document.querySelector(".editor .document");
    if (page && args[0]?.id && args[0].id !== previousId) {
      page.classList.remove("page-enter");
      void page.offsetWidth;
      page.classList.add("page-enter");
    }
    return result;
  };
}

// Card rows on Today scroll sideways with a hidden scrollbar. Make that
// obvious: fade the edge that has more, and add arrows when a row overflows.
{
  const CHEVRON = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const observed = new WeakSet();
  const resizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver((items) => items.forEach((item) => updateCardRow(item.target)))
    : null;

  function updateCardRow(row) {
    const max = row.scrollWidth - row.clientWidth;
    const overflow = max > 4;
    const atStart = row.scrollLeft <= 2;
    const atEnd = row.scrollLeft >= max - 2;
    row.classList.toggle("fade-left", overflow && !atStart);
    row.classList.toggle("fade-right", overflow && !atEnd);
    const nav = row._cardsNav;
    if (!nav) return;
    nav.hidden = !overflow;
    nav.querySelector("[data-cards-prev]").disabled = atStart;
    nav.querySelector("[data-cards-next]").disabled = atEnd;
  }

  function scrollCardRow(row, direction) {
    const card = row.querySelector(".home-card");
    const step = card ? card.getBoundingClientRect().width + 14 : row.clientWidth * 0.8;
    const pages = Math.max(1, Math.floor(row.clientWidth / step));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollBy({ left: direction * step * pages, behavior: reduce ? "auto" : "smooth" });
  }

  function enhanceCardRows() {
    document.querySelectorAll(".home-view .home-cards").forEach((row) => {
      if (!observed.has(row)) {
        observed.add(row);
        const header = row.closest(".home-section")?.querySelector(".home-section-header");
        if (header) {
          const label = header.querySelector("h2")?.textContent.trim() || "cards";
          const nav = document.createElement("div");
          nav.className = "cards-nav";
          nav.hidden = true;
          nav.innerHTML = `
            <button type="button" class="cards-nav-btn" data-cards-prev aria-label="Scroll ${label} back">${CHEVRON("m15 6-6 6 6 6")}</button>
            <button type="button" class="cards-nav-btn" data-cards-next aria-label="Scroll ${label} forward">${CHEVRON("m9 6 6 6-6 6")}</button>`;
          nav.querySelector("[data-cards-prev]").addEventListener("click", () => scrollCardRow(row, -1));
          nav.querySelector("[data-cards-next]").addEventListener("click", () => scrollCardRow(row, 1));
          header.append(nav);
          row._cardsNav = nav;
        }
        row.addEventListener("scroll", () => updateCardRow(row), { passive: true });
        resizeObserver?.observe(row);
      }
      updateCardRow(row);
    });
  }

  const originalRenderHomeView = renderHomeView;
  renderHomeView = function renderHomeViewWithCardRows(...args) {
    const result = originalRenderHomeView.apply(this, args);
    enhanceCardRows();
    return result;
  };
  window.addEventListener("resize", enhanceCardRows);
  enhanceCardRows();
}

// Choose which Spaces show on Today. The choice lives on the server
// (notebooks.show_on_today, migration 0015) so it syncs across devices; until
// that column exists, the server leaves showOnToday undefined and the choice
// is kept on this device instead.
{
  const LOCAL_KEY = "edge_today_hidden_spaces";
  const spacePalette = ["#0f7f74", "#55701f", "#9a5a17", "#874486", "#2f57ec", "#a33f33"];
  const spaces = { editing: false };
  const editBtn = document.querySelector("[data-spaces-edit]");
  const hint = document.querySelector("[data-spaces-hint]");
  const HINT_TEXT = "Tap a Space to show or hide it on Today.";

  function readLocalHidden() {
    try { return new Set(JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]").map(Number)); } catch { return new Set(); }
  }
  function writeLocalHidden(set) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify([...set])); } catch {}
  }
  function isHidden(nb) {
    if (nb.showOnToday === false) return true;
    if (nb.showOnToday === true) return false;
    return readLocalHidden().has(Number(nb.id));
  }

  const MARK = '<svg class="space-cover-mark" viewBox="0 0 18 15" aria-hidden="true"><rect width="18" height="3" rx="1.5"/><rect y="6" width="12" height="3" rx="1.5"/><rect y="12" width="18" height="3" rx="1.5"/></svg>';
  const CHECK = '<span class="space-cover-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>';

  // Once the server tracks the choice (migration 0015 ran), carry over any
  // Spaces this device hid before that, then forget the local copy.
  let carryingOver = false;
  async function carryOverLocalChoices() {
    if (carryingOver) return;
    const local = readLocalHidden();
    if (!local.size) return;
    const tracked = state.notebooks.filter((nb) => nb.showOnToday !== undefined);
    if (!tracked.length) return;
    carryingOver = true;
    try {
      for (const nb of tracked) {
        if (!local.has(Number(nb.id))) continue;
        if (nb.showOnToday) {
          await requestJson(`/api/notebooks/${encodeURIComponent(nb.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ showOnToday: false })
          });
          nb.showOnToday = false;
        }
        local.delete(Number(nb.id));
      }
      // Ids that no longer exist are dropped too
      writeLocalHidden(new Set([...local].filter((id) => state.notebooks.some((nb) => Number(nb.id) === id && nb.showOnToday === undefined))));
      renderHomeNotebooks();
    } catch {
      // Keep the local copy and try again on the next render
    } finally {
      carryingOver = false;
    }
  }

  renderHomeNotebooks = function renderChosenSpaces() {
    if (!elements.homeNotebooks) return;
    carryOverLocalChoices();
    const totalCount = (nb) => Number(nb.noteCount || 0)
      + state.notebooks.filter((child) => child.parentId === nb.id).reduce((sum, child) => sum + totalCount(child), 0);
    // Colours are assigned before filtering so hiding a Space never recolours the rest
    const all = state.notebooks
      .filter((nb) => !nb.parentId && totalCount(nb) > 0)
      .map((nb, index) => {
        const own = nb.iconColor && nb.iconColor !== "#a0a0a8" ? nb.iconColor : null;
        const color = sanitizeCssColor(own || spacePalette[index % spacePalette.length]) || spacePalette[0];
        return { nb, color, count: totalCount(nb), hidden: isHidden(nb) };
      });

    const card = ({ nb, color, count, hidden }) => {
      const label = `${count} note${count === 1 ? "" : "s"}`;
      if (spaces.editing) {
        return `<button class="space-cover is-choosing${hidden ? " is-off" : ""}" type="button" data-space-toggle="${nb.id}" aria-pressed="${hidden ? "false" : "true"}" aria-label="${escapeHtml(nb.name)}, ${hidden ? "hidden from" : "shown on"} Today" style="--nb-color:${escapeHtml(color)}">
          ${MARK}${CHECK}<strong>${escapeHtml(nb.name)}</strong><span>${hidden ? "Hidden" : label}</span>
        </button>`;
      }
      return `<button class="space-cover" type="button" data-notebook-filter="${nb.id}" style="--nb-color:${escapeHtml(color)}">
        ${MARK}<strong>${escapeHtml(nb.name)}</strong><span>${label}</span>
      </button>`;
    };

    const visible = spaces.editing ? all : all.filter((s) => !s.hidden);
    const hiddenCount = all.filter((s) => s.hidden).length;
    let html = visible.map(card).join("");
    if (!all.length) html = '<p class="home-empty">Notebooks you add show up here as Spaces.</p>';
    else if (!visible.length) html = '<p class="home-empty">All Spaces are hidden. Use Choose to bring some back.</p>';
    elements.homeNotebooks.innerHTML = html;

    if (editBtn) {
      editBtn.textContent = spaces.editing ? "Done" : hiddenCount ? `Choose (${hiddenCount} hidden)` : "Choose";
      editBtn.setAttribute("aria-pressed", spaces.editing ? "true" : "false");
      editBtn.hidden = !all.length;
    }
    if (hint) hint.hidden = !spaces.editing;
    elements.homeNotebooks.closest(".today-spaces")?.classList.toggle("is-choosing", spaces.editing);
  };

  function setHint(text, isError = false) {
    if (!hint) return;
    hint.textContent = text;
    hint.classList.toggle("is-error", isError);
  }

  async function toggleSpace(id) {
    const nb = state.notebooks.find((n) => Number(n.id) === Number(id));
    if (!nb) return;
    const nextHidden = !isHidden(nb);
    const serverTracks = nb.showOnToday !== undefined;
    const previous = nb.showOnToday;
    const local = readLocalHidden();

    // Optimistic: show the change straight away
    if (serverTracks) nb.showOnToday = !nextHidden;
    if (nextHidden) local.add(Number(id)); else local.delete(Number(id));
    writeLocalHidden(local);
    renderHomeNotebooks();

    try {
      await requestJson(`/api/notebooks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ showOnToday: !nextHidden })
      });
      nb.showOnToday = !nextHidden;
      setHint(HINT_TEXT);
    } catch (error) {
      if (error.status === 409) {
        // Database has not run migration 0015: keep the choice on this device
        nb.showOnToday = undefined;
        setHint("Saved on this device. It syncs everywhere once the database update is run.");
      } else {
        nb.showOnToday = previous;
        if (nextHidden) local.delete(Number(id)); else local.add(Number(id));
        writeLocalHidden(local);
        setHint(`Couldn't save: ${error.message}`, true);
      }
    }
    renderHomeNotebooks();
    // Keep keyboard focus on the same Space after re-render
    elements.homeNotebooks?.querySelector(`[data-space-toggle="${CSS.escape(String(id))}"]`)?.focus();
  }

  editBtn?.addEventListener("click", () => {
    spaces.editing = !spaces.editing;
    setHint(HINT_TEXT);
    renderHomeNotebooks();
    if (spaces.editing) elements.homeNotebooks?.querySelector("[data-space-toggle]")?.focus();
  });
  elements.homeNotebooks?.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-space-toggle]");
    if (!toggle) return;
    event.stopPropagation();
    toggleSpace(toggle.dataset.spaceToggle);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && spaces.editing) {
      spaces.editing = false;
      renderHomeNotebooks();
      editBtn?.focus();
    }
  });
  renderHomeNotebooks();
}
