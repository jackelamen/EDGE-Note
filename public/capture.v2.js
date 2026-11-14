// Quick-capture bubble. The Mac app shows this page in a small floating
// window (capture.html?bubble=1); it also works as a plain page in a browser.
// Adds a timestamped line (or a task) to today's daily note, the same note
// the Today view writes to.
//
// The shell closes or hands off by navigating to /__capture/done and
// /__capture/open, which it intercepts; nothing is ever loaded from them.
const params = new URLSearchParams(location.search);
const inBubble = params.has("bubble");

const form = document.getElementById("form");
const input = document.getElementById("text");
const addBtn = document.getElementById("add");
const taskBtn = document.getElementById("task");
const statusEl = document.getElementById("status");
const signinBtn = document.getElementById("signin");
const hint = document.getElementById("hint");

let busy = false;

// The Android widget's check button opens the bubble in task mode.
if (params.get("task") === "1") taskBtn.setAttribute("aria-pressed", "true");

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dailyTitle = () => `Daily note · ${dateKey()}`;
const legacyTitle = () => `Daily note — ${dateKey()}`;
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function captureHtml(text, asTask) {
  return asTask
    ? `<ul class="checklist"><li class="task-item"><input type="checkbox" data-task-check> ${escapeHtml(text)}</li></ul>`
    : `<p><strong>${nowTime()}</strong> ${escapeHtml(text)}</p>`;
}

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { "content-type": "application/json" }, credentials: "same-origin", ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "Request failed");
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function appendToDailyNote(html) {
  const titles = new Set([dailyTitle(), legacyTitle()]);
  const found = ((await api(`/api/notes?q=${encodeURIComponent(dateKey())}&limit=20&archived=all`)).notes || [])
    .find((n) => titles.has(n.title));
  if (found) {
    // Read the latest copy first so a capture never overwrites newer edits
    const fresh = (await api(`/api/notes/${found.id}`)).note;
    await api(`/api/notes/${found.id}`, {
      method: "PUT",
      body: JSON.stringify({ body: `${fresh.body || ""}${html}`, bodyFormat: "html" })
    });
    return;
  }
  await api("/api/notes", {
    method: "POST",
    body: JSON.stringify({
      title: dailyTitle(), body: html, bodyFormat: "html", tags: ["daily"],
      clientId: `${Date.now()}-${Math.random().toString(16).slice(2)}`
    })
  });
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("err", isError);
  hint.hidden = Boolean(text);
}

function refreshButtons() {
  addBtn.disabled = busy || !input.value.trim();
}

function leave(target) {
  // Only meaningful inside the Mac app, which intercepts this navigation.
  if (inBubble) location.href = `/__capture/${target}`;
}

async function submit(asTask = taskBtn.getAttribute("aria-pressed") === "true") {
  const text = input.value.trim();
  if (!text || busy) return;
  busy = true;
  refreshButtons();
  setStatus("");
  try {
    await appendToDailyNote(captureHtml(text, asTask));
    input.value = "";
    setStatus(asTask ? "Task added" : "Added to today");
    setTimeout(() => {
      setStatus("");
      busy = false;
      refreshButtons();
      leave("done");
    }, inBubble ? 520 : 1400);
  } catch (error) {
    busy = false;
    refreshButtons();
    if (error.status === 401) {
      setStatus("Sign in to EDGE Note first", true);
      signinBtn.hidden = !inBubble;
    } else {
      setStatus(`Couldn't save: ${error.message}`, true);
    }
  }
}

form.addEventListener("submit", (event) => { event.preventDefault(); submit(); });
input.addEventListener("input", () => { refreshButtons(); if (statusEl.classList.contains("err")) setStatus(""); });
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit(true); }
});
taskBtn.addEventListener("click", () => {
  taskBtn.setAttribute("aria-pressed", taskBtn.getAttribute("aria-pressed") === "true" ? "false" : "true");
  input.focus();
});
signinBtn.addEventListener("click", () => leave("open"));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") leave("done"); });

// The shell calls this each time the bubble is shown.
window.__edgeCaptureReady = () => {
  setStatus("");
  signinBtn.hidden = true;
  input.focus();
  input.select();
};
window.addEventListener("focus", () => input.focus());
input.focus();
