// Captures made without a connection wait here (localStorage, shared by the
// app and the capture bubble because they run on the same origin) and are
// added to the daily note of the day they were captured once the server is
// reachable. Each entry keeps the HTML it would have added, time included.

const KEY = "edge_capture_queue_v1";

const pad = (n) => String(n).padStart(2, "0");
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dailyTitle = (key = dateKey()) => `Daily note · ${key}`;
const legacyTitle = (key) => `Daily note — ${key}`;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

export function queuedCaptures() {
  return read();
}

export function queueCapture(html, date = new Date()) {
  const list = read();
  list.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    day: dateKey(date),
    html,
    queuedAt: new Date().toISOString()
  });
  write(list);
  return list.length;
}

export function clearQueue() {
  write([]);
}

// A network failure (no connection, server unreachable), as opposed to the
// server answering with an error.
export function isNetworkError(error) {
  return !error?.status || error.status === 502 || error.status === 503 || error.status === 504;
}

// api(url, options) must resolve to the parsed JSON body or throw with .status.
let flushing = null;
export function flushCaptures(api) {
  if (flushing) return flushing;
  flushing = (async () => {
    let added = 0;
    for (;;) {
      const list = read();
      if (!list.length) break;
      const day = list[0].day;
      const batch = list.filter((entry) => entry.day === day);
      const html = batch.map((entry) => entry.html).join("");
      const titles = new Set([dailyTitle(day), legacyTitle(day)]);
      const found = ((await api(`/api/notes?q=${encodeURIComponent(day)}&limit=20&archived=all`)).notes || [])
        .find((n) => titles.has(n.title));
      if (found) {
        const fresh = (await api(`/api/notes/${found.id}`)).note;
        await api(`/api/notes/${found.id}`, {
          method: "PUT",
          body: JSON.stringify({ body: `${fresh.body || ""}${html}`, bodyFormat: "html" })
        });
      } else {
        await api("/api/notes", {
          method: "POST",
          body: JSON.stringify({
            title: dailyTitle(day), body: html, bodyFormat: "html", tags: ["daily"],
            clientId: `capture-${batch[0].id}`
          })
        });
      }
      // Drop only what was sent; anything captured meanwhile stays queued.
      const sent = new Set(batch.map((entry) => entry.id));
      write(read().filter((entry) => !sent.has(entry.id)));
      added += batch.length;
    }
    return added;
  })().finally(() => { flushing = null; });
  return flushing;
}
