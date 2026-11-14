// On-device copy of the user's notes (IndexedDB), so the app keeps working
// without a connection. requestJson in the app feeds it from every successful
// API read and answers reads from it when the network is unreachable.
//
// Local queries mirror the server's /api/notes filters (src/notesRepository
// listNotes) so offline results match what the server would have returned.

const DB_NAME = "edge-note-offline";
const DB_VERSION = 1;
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) { reject(new Error("IndexedDB unavailable")); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("notes")) db.createObjectStore("notes", { keyPath: "id" });
      // Small GET responses kept whole: /api/notebooks, /api/tags, /api/config, ...
      if (!db.objectStoreNames.contains("responses")) db.createObjectStore("responses");
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => { dbPromise = null; throw error; });
  return dbPromise;
}

function tx(storeNames, mode, work) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    let result;
    Promise.resolve(work(transaction)).then((value) => { result = value; });
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }));
}

const requestToPromise = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

// ── Notes ──
export function upsertNotes(notes) {
  const list = (notes || []).filter((n) => n && n.id != null);
  if (!list.length) return Promise.resolve();
  return tx(["notes"], "readwrite", (t) => {
    const store = t.objectStore("notes");
    list.forEach((note) => store.put(note));
  }).catch(() => {});
}

export function removeNote(id) {
  return tx(["notes"], "readwrite", (t) => { t.objectStore("notes").delete(Number(id)); }).catch(() => {});
}

// Replace the whole collection (a full list from the server is the truth;
// notes deleted elsewhere disappear). scope "active" keeps archived copies.
export function replaceAllNotes(notes, scope = "all") {
  return tx(["notes", "meta"], "readwrite", async (t) => {
    const store = t.objectStore("notes");
    if (scope === "all") {
      store.clear();
    } else {
      const existing = await requestToPromise(store.getAll());
      existing.filter((n) => !n.archivedAt).forEach((n) => store.delete(n.id));
    }
    (notes || []).forEach((note) => store.put(note));
    t.objectStore("meta").put(new Date().toISOString(), "notesSyncedAt");
  }).catch(() => {});
}

export function allNotes() {
  return tx(["notes"], "readonly", (t) => requestToPromise(t.objectStore("notes").getAll()))
    .catch(() => []);
}

export function getNote(id) {
  return tx(["notes"], "readonly", (t) => requestToPromise(t.objectStore("notes").get(Number(id))))
    .catch(() => undefined);
}

export function notesSyncedAt() {
  return tx(["meta"], "readonly", (t) => requestToPromise(t.objectStore("meta").get("notesSyncedAt")))
    .catch(() => undefined);
}

export async function hasLocalData() {
  const notes = await allNotes();
  return notes.length > 0;
}

// ── Whole responses ──
export function putResponse(key, payload) {
  return tx(["responses"], "readwrite", (t) => { t.objectStore("responses").put(payload, key); }).catch(() => {});
}

export function getResponse(key) {
  return tx(["responses"], "readonly", (t) => requestToPromise(t.objectStore("responses").get(key)))
    .catch(() => undefined);
}

// Signing out removes everything kept on the device.
export async function wipe() {
  try {
    await tx(["notes", "responses", "meta"], "readwrite", (t) => {
      t.objectStore("notes").clear();
      t.objectStore("responses").clear();
      t.objectStore("meta").clear();
    });
  } catch {}
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("edge-") && k.includes("attachments")).map((k) => caches.delete(k)));
    }
  } catch {}
}

// ── Local query, mirroring the server's listNotes ──
const strip = (html) => String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const TASK_PATTERN = /- \[[ xX]\]|type="checkbox"/;

export async function queryNotes(searchParams) {
  const params = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams || "");
  const term = (params.get("q") || "").trim().toLowerCase();
  const notebookId = Number(params.get("notebookId")) || null;
  const tag = (params.get("tag") || "").trim().replace(/^#/, "").toLowerCase();
  const favorite = params.get("favorite") === "1";
  const tasks = params.get("tasks") === "1";
  const archived = params.get("archived") || "active";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 1000);

  let notes = (await allNotes()).filter((n) => {
    if (notebookId && Number(n.notebookId) !== notebookId) return false;
    if (tag && !(n.tags || []).map((t) => String(t).toLowerCase()).includes(tag)) return false;
    if (favorite && !n.favorite) return false;
    if (tasks && !TASK_PATTERN.test(n.body || "")) return false;
    if (archived === "only" && !n.archivedAt) return false;
    if (archived === "active" && n.archivedAt) return false;
    return true;
  });

  const time = (n) => Date.parse(n.updatedAt || 0) || 0;
  if (term) {
    const score = (n) => {
      const title = String(n.title || "").toLowerCase();
      const tags = (n.tags || []).join(",").toLowerCase();
      if (title === term) return 100;
      if (title.startsWith(term)) return 80;
      if (title.includes(term)) return 60;
      if (tags.includes(term)) return 45;
      if (strip(n.body).toLowerCase().includes(term) || String(n.body || "").toLowerCase().includes(term)) return 20;
      return -1;
    };
    notes = notes
      .map((n) => ({ n, s: score(n) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s || time(b.n) - time(a.n))
      .map((x) => x.n);
  } else {
    notes.sort((a, b) => time(b) - time(a));
  }
  return notes.slice(0, limit);
}

// Graph data built from the local copy (mirrors /api/graph).
export async function localGraph() {
  const notes = (await allNotes()).filter((n) => !n.archivedAt);
  const nodes = notes.map((n) => ({
    id: n.id,
    title: n.title || "Untitled",
    notebook: n.notebookName || "",
    tags: (n.tags || []).map((t) => String(t).trim()).filter(Boolean),
    snippet: strip(n.body).replace(/\s+/g, " ").trim().slice(0, 180),
    updatedAt: n.updatedAt
  }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = new Map();
  const edge = (a, b) => {
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (!edges.has(key)) edges.set(key, { source: Math.min(a, b), target: Math.max(a, b), tags: [], inlineLinks: 0, types: [] });
    return edges.get(key);
  };
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const shared = nodes[i].tags.filter((t) => nodes[j].tags.includes(t));
      if (shared.length) {
        const e = edge(nodes[i].id, nodes[j].id);
        e.tags = [...new Set([...e.tags, ...shared])];
        if (!e.types.includes("tag")) e.types.push("tag");
      }
    }
  }
  const linkPattern = /\bdata-note-link\s*=\s*(?:"(\d+)"|'(\d+)'|(\d+))/gi;
  for (const note of notes) {
    let match;
    linkPattern.lastIndex = 0;
    while ((match = linkPattern.exec(String(note.body || "")))) {
      const target = Number(match[1] || match[2] || match[3]);
      if (target === note.id || !ids.has(target)) continue;
      const e = edge(note.id, target);
      e.inlineLinks += 1;
      if (!e.types.includes("inline")) e.types.push("inline");
    }
  }
  return { nodes, edges: [...edges.values()] };
}
