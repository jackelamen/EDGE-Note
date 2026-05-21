const state = {
  notes: [],
  selectedId: null,
  pendingSave: false
};

const elements = {
  body: document.querySelector("[data-note-body]"),
  list: document.querySelector("[data-notes-list]"),
  meta: document.querySelector("[data-note-meta]"),
  newNote: document.querySelector("[data-action='new-note']"),
  saveNote: document.querySelector("[data-action='save-note']"),
  search: document.querySelector("[data-notes-search]"),
  title: document.querySelector("[data-note-title]")
};

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

function setStatus(text) {
  elements.meta.innerHTML = `
    <span>#markdown</span>
    <span>${state.selectedId ? `Note ${state.selectedId}` : "Draft"}</span>
    <span>${escapeHtml(text)}</span>
  `;
}

function currentDraft() {
  return {
    title: elements.title.value,
    body: elements.body.value,
    bodyFormat: "markdown"
  };
}

function selectNote(note) {
  state.selectedId = note?.id || null;
  elements.title.value = note?.title || "Untitled note";
  elements.body.value = note?.body || "";
  setStatus(note?.updatedAt ? `Updated ${formatDate(note.updatedAt)}` : "Not saved yet");
  renderNotes();
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
      <span class="tag">${note.favorite ? "Favorite" : "Note"}</span>
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

async function loadNotes() {
  const params = new URLSearchParams();
  const search = elements.search.value.trim();
  if (search) params.set("q", search);

  try {
    const payload = await requestJson(`/api/notes${params.size ? `?${params}` : ""}`);
    state.notes = payload.notes || [];
    renderNotes();
    if (state.notes.length && !state.selectedId) {
      selectNote(state.notes[0]);
    }
    if (!state.notes.length) {
      setStatus("Ready for first note");
    }
  } catch (error) {
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
    setStatus("Database setup needed");
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
    setStatus(`Saved ${formatDate(saved.updatedAt)}`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    state.pendingSave = false;
    elements.saveNote.textContent = "Sync";
  }
}

function bindEvents() {
  elements.newNote.addEventListener("click", () => {
    state.selectedId = null;
    elements.title.value = "Untitled note";
    elements.body.value = "";
    setStatus("New draft");
    renderNotes();
    elements.title.focus();
  });

  elements.saveNote.addEventListener("click", saveNote);

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

bindEvents();
hydrateConfig();
loadNotes();
