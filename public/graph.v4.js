// Graph, lit-page edition (graph.v3). The focal note is the one lit node on an
// ink field; neighbours carry their Space colour, the second ring fades back.
// Loaded as an external module because the CSP blocks inline scripts;
// graph.html alone may load d3 from cdn.jsdelivr.net.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

let ALL_NODES = [];
let ALL_EDGES = [];
let focusId = null;
let simulation = null;
let zoomBehavior = null;
let currentLinkData = [];
let currentNodeData = [];
let pinnedId = null;
let view = null; // { svg, g, W, H }

const filters = {
  depth: 2,
  showOrphans: false,
  showLinkLabels: false,
  nodeSizeMul: 1,
  textFade: 2,
  repulsion: 420,
  hiddenSpaces: new Set()
};

// Same Space order and hues as the Today covers, brightened for a dark field.
const COVER_PALETTE = ["#0f7f74", "#55701f", "#9a5a17", "#874486", "#2f57ec", "#a33f33"];
const FIELD_PALETTE = ["#2bb3a4", "#9bc04a", "#e0954a", "#c780c1", "#7d99ff", "#e07a6c"];
const NO_SPACE = "#a3aec0";
const ORPHAN = "#3a4a63";
const FIELD_BG = "#0e1a2b";

const spaceOfNotebook = new Map(); // notebook name -> root Space name
const spaceColor = new Map();      // root Space name -> field colour

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));

function brighten(hex, amount = 0.3) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return NO_SPACE;
  const n = parseInt(m[1], 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

function buildSpaces(notebooks) {
  const byId = new Map(notebooks.map((nb) => [nb.id, nb]));
  const rootOf = (nb) => {
    let cur = nb;
    for (let i = 0; cur?.parentId && i < 20; i++) cur = byId.get(cur.parentId) || cur;
    return cur;
  };
  const total = (nb) => Number(nb.noteCount || 0)
    + notebooks.filter((c) => c.parentId === nb.id).reduce((s, c) => s + total(c), 0);
  notebooks
    .filter((nb) => !nb.parentId && total(nb) > 0)
    .forEach((nb, i) => {
      const own = nb.iconColor && nb.iconColor !== "#a0a0a8" ? nb.iconColor : null;
      spaceColor.set(nb.name, own ? brighten(own) : FIELD_PALETTE[i % FIELD_PALETTE.length]);
    });
  notebooks.forEach((nb) => spaceOfNotebook.set(nb.name, rootOf(nb)?.name || nb.name));
}

function spaceName(n) { return n.notebook ? (spaceOfNotebook.get(n.notebook) || n.notebook) : ""; }
function colorFor(n) {
  if (n.orphan) return ORPHAN;
  const s = spaceName(n);
  if (!s) return NO_SPACE;
  if (!spaceColor.has(s)) spaceColor.set(s, FIELD_PALETTE[spaceColor.size % FIELD_PALETTE.length]);
  return spaceColor.get(s);
}

function openNote(noteId) {
  const id = Number(noteId);
  if (!id) return;
  try { localStorage.setItem("edge_note_selected_note_v1", String(id)); } catch {}
  sessionStorage.setItem("edge_note_internal_navigation_v1", "1");
  window.location.href = `/?note=${encodeURIComponent(id)}`;
}

const svgEl = document.getElementById("graph-canvas");
const loading = document.getElementById("loading");
const emptyState = document.getElementById("empty-state");
const filterPanel = document.getElementById("filter-panel");
const statsEl = document.getElementById("graph-stats");
const card = document.getElementById("note-card");
const btnFilters = document.getElementById("btn-filters");

// ── Load ──
// Without a connection, build the same graph from the notes saved on this
// device (the app keeps that copy; see offline-store.v1.js).
async function offlineGraph() {
  const store = await import("/offline-store.v1.js");
  const data = await store.localGraph();
  if (!data.nodes.length) throw new Error("the graph needs a connection the first time");
  const saved = await store.getResponse("/api/notebooks");
  return { data, notebooks: saved?.notebooks || [], offline: true };
}

async function onlineGraph() {
  const [graphRes, nbRes] = await Promise.all([fetch("/api/graph"), fetch("/api/notebooks").catch(() => null)]);
  if (graphRes.status === 401) { window.location.href = "/"; return null; }
  if ([502, 503, 504].includes(graphRes.status)) return offlineGraph();
  if (!graphRes.ok) throw new Error(`Graph API error ${graphRes.status}`);
  const data = await graphRes.json();
  const nb = nbRes?.ok ? await nbRes.json().catch(() => ({})) : {};
  return { data, notebooks: nb.notebooks || [], offline: false };
}

async function loadGraph() {
  let result;
  try {
    result = await onlineGraph();
  } catch (error) {
    if (error instanceof TypeError) result = await offlineGraph();
    else throw error;
  }
  if (!result) return;
  ALL_NODES = result.data.nodes || [];
  ALL_EDGES = result.data.edges || [];
  buildSpaces(result.notebooks);
  if (result.offline) document.querySelector(".graph-eyebrow").textContent = "LOCAL GRAPH \u00b7 OFFLINE";

  const spaces = [...new Set(ALL_NODES.map(spaceName).filter(Boolean))]
    .sort((a, b) => [...spaceColor.keys()].indexOf(a) - [...spaceColor.keys()].indexOf(b));
  const nbList = document.getElementById("fp-nb-list");
  nbList.innerHTML = spaces.length
    ? spaces.map((s, i) => `
        <label class="fp-nb-item" for="sp-${i}">
          <input type="checkbox" id="sp-${i}" checked data-space="${escapeHtml(s)}">
          <span class="chip-dot" style="background:${colorFor({ notebook: s })}"></span>
          <span>${escapeHtml(s)}</span>
        </label>`).join("")
    : '<span class="fp-empty">No Spaces yet</span>';
  nbList.querySelectorAll("input[data-space]").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) filters.hiddenSpaces.delete(cb.dataset.space);
      else filters.hiddenSpaces.add(cb.dataset.space);
      renderGraph();
    });
  });

  const paramId = Number(new URLSearchParams(location.search).get("note")) || null;
  focusId = paramId && ALL_NODES.some((n) => n.id === paramId)
    ? paramId
    : mostConnectedId();

  loading.style.display = "none";
  if (!focusId) {
    document.getElementById("graph-title").textContent = "No notes yet";
    emptyState.style.display = "block";
    return;
  }
  renderGraph();
}

function mostConnectedId() {
  if (!ALL_NODES.length) return null;
  const deg = new Map();
  for (const e of ALL_EDGES) {
    deg.set(e.source, (deg.get(e.source) || 0) + 1);
    deg.set(e.target, (deg.get(e.target) || 0) + 1);
  }
  return [...ALL_NODES].sort((a, b) => (deg.get(b.id) || 0) - (deg.get(a.id) || 0))[0].id;
}

// ── Local subgraph (BFS from the focal note) ──
function buildLocalGraph(fId, maxDepth) {
  const nodeMap = new Map(ALL_NODES.map((n) => [n.id, n]));
  const adj = new Map();
  for (const e of ALL_EDGES) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source).add(e.target);
    adj.get(e.target).add(e.source);
  }
  const level = new Map([[fId, 0]]);
  const queue = [fId];
  while (queue.length) {
    const cur = queue.shift();
    const d = level.get(cur);
    if (d >= maxDepth) continue;
    for (const nId of adj.get(cur) || []) {
      if (!level.has(nId)) { level.set(nId, d + 1); queue.push(nId); }
    }
  }
  const keep = new Map();
  for (const [id, lvl] of level) {
    const n = nodeMap.get(id);
    if (!n) continue;
    if (id !== fId && filters.hiddenSpaces.has(spaceName(n))) continue;
    keep.set(id, lvl);
  }
  if (filters.showOrphans) {
    for (const n of ALL_NODES) {
      if (!adj.has(n.id) && !keep.has(n.id) && !filters.hiddenSpaces.has(spaceName(n))) keep.set(n.id, maxDepth + 1);
    }
  }
  const nodes = [...keep].map(([id, lvl]) => ({ ...nodeMap.get(id), level: lvl, orphan: lvl > maxDepth }));
  const ids = new Set(keep.keys());
  const edges = ALL_EDGES.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ ...e }));
  return { nodes, edges };
}

const idOf = (x) => (x && typeof x === "object" ? x.id : x);

function edgeLabel(edge) {
  const parts = [];
  if (edge.tags?.length) parts.push(edge.tags.slice(0, 2).map((t) => `#${t}`).join(" "));
  if ((edge.types || []).includes("inline") || edge.inlineLinks > 0) parts.push("link");
  return parts.join(" + ");
}

function nodeRadius(n, degree) {
  let r;
  if (n.id === focusId) r = 13;
  else if (n.orphan) r = 4;
  else if (n.level === 1) r = Math.max(7, Math.min(10, 5 + (degree.get(n.id) || 0)));
  else r = Math.max(5, Math.min(7, 4 + (degree.get(n.id) || 0) * 0.5));
  return r * filters.nodeSizeMul;
}

function renderHeader(focal, nodes) {
  document.getElementById("graph-title").textContent = focal.title;
  document.title = `${focal.title} · Graph · EDGE Note`;
  const spaces = [...new Set(nodes.filter((n) => !n.orphan).map(spaceName).filter(Boolean))];
  const steps = `<span class="chip chip-solid">${filters.depth} step${filters.depth === 1 ? "" : "s"}</span>`;
  document.getElementById("graph-chips").innerHTML = steps + spaces.map((s) =>
    `<span class="chip"><span class="chip-dot" style="background:${colorFor({ notebook: s })}"></span>${escapeHtml(s)}</span>`
  ).join("");
}

// ── Render ──
function renderGraph() {
  const focal = ALL_NODES.find((n) => n.id === focusId);
  if (!focal) return;
  simulation?.stop();
  pinnedId = null;
  hideCard();

  const url = new URL(location.href);
  url.searchParams.set("note", focusId);
  history.replaceState(null, "", url);

  const { nodes, edges } = buildLocalGraph(focusId, filters.depth);
  currentNodeData = nodes;
  renderHeader(focal, nodes);
  emptyState.style.display = edges.length === 0 ? "block" : "none";
  statsEl.textContent = `${nodes.filter((n) => !n.orphan).length} notes · ${edges.length} links`;

  svgEl.innerHTML = "";
  const box = svgEl.getBoundingClientRect();
  const W = Math.max(320, box.width);
  const H = Math.max(320, box.height);
  const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`);

  const defs = svg.append("defs");
  defs.append("filter").attr("id", "glow").attr("x", "-100%").attr("y", "-100%").attr("width", "300%").attr("height", "300%")
    .html('<feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>');
  defs.append("filter").attr("id", "glow-focal").attr("x", "-200%").attr("y", "-200%").attr("width", "500%").attr("height", "500%")
    .html('<feGaussianBlur stdDeviation="14"/>');

  const g = svg.append("g").attr("class", "root");
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const linkData = edges.map((e) => ({ ...e, source: nodeMap.get(e.source), target: nodeMap.get(e.target) }));
  currentLinkData = linkData;

  const degree = new Map();
  for (const e of linkData) {
    degree.set(e.source.id, (degree.get(e.source.id) || 0) + 1);
    degree.set(e.target.id, (degree.get(e.target.id) || 0) + 1);
  }

  // Narrow fields (phones) get a tighter layout so the fit keeps labels legible
  const k = Math.max(0.7, Math.min(1, W / 600));

  const focalNode = nodeMap.get(focusId);
  Object.assign(focalNode, { fx: W / 2, fy: H / 2, x: W / 2, y: H / 2 });
  const others = nodes.filter((n) => n.id !== focusId);
  others.forEach((n, i) => {
    const angle = (i / Math.max(others.length, 1)) * Math.PI * 2;
    const r = n.orphan ? Math.min(W, H) * 0.45 : (160 + n.level * 90) * k;
    const tall = H > W * 1.2 ? 1.5 : 1;
    n.x = W / 2 + Math.cos(angle) * r / tall;
    n.y = H / 2 + Math.sin(angle) * r * tall;
  });

  const isNear = (e) => e.source.id === focusId || e.target.id === focusId;
  const edgeStroke = (e) => (isNear(e) ? "rgba(125,153,255,.55)" : "rgba(255,255,255,.12)");
  const edgeWidth = (e) => (isNear(e) ? 1.6 : 1);

  simulation = d3.forceSimulation(nodes)
    .alpha(1)
    .alphaDecay(0.025)
    .force("link", d3.forceLink(linkData).id((d) => d.id)
      .distance((d) => (150 + Math.max(d.source.level, d.target.level) * 60) * k)
      .strength(0.45))
    .force("charge", d3.forceManyBody().strength((d) => (d.id === focusId ? -filters.repulsion * 1.6 : d.orphan ? -30 : -filters.repulsion) * k))
    .force("center", d3.forceCenter(W / 2, H / 2).strength(0.06))
    // Portrait fields: pull toward the vertical axis so the layout uses the height
    .force("x", d3.forceX(W / 2).strength(H > W * 1.2 ? 0.05 : 0))
    .force("collision", d3.forceCollide().radius((d) => nodeRadius(d, degree) + (d.id === focusId ? 70 : 48) * k));

  const link = g.append("g").attr("class", "links")
    .selectAll("line").data(linkData).join("line")
    .attr("stroke", edgeStroke)
    .attr("stroke-width", edgeWidth)
    .attr("stroke-linecap", "round");

  const linkLabel = filters.showLinkLabels
    ? g.append("g").selectAll("text").data(linkData).join("text")
      .attr("font-size", 10).attr("fill", "rgba(201,209,222,.55)").attr("text-anchor", "middle")
      .attr("pointer-events", "none").attr("font-family", "Schibsted Grotesk, sans-serif")
      .text(edgeLabel)
    : null;

  const node = g.append("g").attr("class", "nodes")
    .selectAll("g").data(nodes).join("g")
    .attr("cursor", "pointer")
    .attr("tabindex", (d) => (d.orphan ? null : 0))
    .attr("role", (d) => (d.orphan ? null : "button"))
    .attr("aria-label", (d) => (d.orphan ? null : d.title))
    .call(d3.drag()
      .on("start", (ev, d) => { if (!ev.active) simulation.alphaTarget(0.25).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
      .on("end", (ev, d) => { if (!ev.active) simulation.alphaTarget(0); if (d.id !== focusId) { d.fx = null; d.fy = null; } }));

  // Focal: a lit white node with one slow halo
  const focalG = node.filter((d) => d.id === focusId);
  focalG.append("circle").attr("class", "focal-halo")
    .attr("r", (d) => nodeRadius(d, degree) + 12)
    .attr("fill", "rgba(255,255,255,.55)")
    .attr("filter", "url(#glow-focal)");

  node.append("circle")
    .attr("class", "node-dot")
    .attr("r", (d) => nodeRadius(d, degree))
    .attr("fill", (d) => (d.id === focusId ? "#ffffff" : colorFor(d)))
    .attr("stroke", FIELD_BG)
    .attr("stroke-width", (d) => (d.id === focusId ? 4 : 3))
    .attr("filter", (d) => (d.level === 1 && !d.orphan ? "url(#glow)" : null));

  const label = node.append("text")
    .attr("class", (d) => `node-label${d.id === focusId ? " is-focal" : ""}`)
    .attr("dy", (d) => nodeRadius(d, degree) + (d.id === focusId ? 26 : 17))
    .attr("text-anchor", "middle")
    .attr("fill", (d) => (d.id === focusId ? "#ffffff" : "#c9d1de"))
    .attr("font-size", (d) => (d.id === focusId ? 21 : d.level === 1 ? 13 : 12))
    .attr("font-weight", 500)
    .attr("pointer-events", "none")
    .text((d) => (d.orphan ? "" : d.title.length > 30 ? `${d.title.slice(0, 29)}…` : d.title));

  // Depth recedes: the second ring and beyond sit back
  const restOpacity = (d) => (d.id === focusId ? 1 : d.orphan ? 0.5 : d.level >= 2 ? 0.55 : 1);
  let labelsVisible = true;
  const labelOpacity = (d) => (d.id === focusId ? 1 : labelsVisible ? restOpacity(d) : 0);

  // Arrival: rings settle in by depth, focal first
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  node.attr("opacity", reduceMotion ? restOpacity : 0);
  link.attr("opacity", reduceMotion ? 1 : 0);
  if (!reduceMotion) {
    node.transition().delay((d) => (d.orphan ? 520 : Math.min(d.level, 3) * 160)).duration(420).ease(d3.easeCubicOut)
      .attr("opacity", restOpacity);
    link.transition().delay(180).duration(520).attr("opacity", 1);
  }

  zoomBehavior = d3.zoom().scaleExtent([0.1, 5]).on("zoom", (ev) => {
    g.attr("transform", ev.transform);
    labelsVisible = ev.transform.k >= filters.textFade * 0.2;
    label.attr("opacity", labelOpacity);
  });
  svg.call(zoomBehavior).on("dblclick.zoom", null);

  // ── Highlight + card ──
  function highlight(d) {
    if (!d) {
      node.attr("opacity", restOpacity);
      label.attr("opacity", labelOpacity);
      link.attr("stroke", edgeStroke).attr("stroke-width", edgeWidth);
      return;
    }
    const touches = (e) => e.source.id === d.id || e.target.id === d.id;
    const near = new Set([d.id]);
    linkData.forEach((e) => { if (touches(e)) { near.add(e.source.id); near.add(e.target.id); } });
    node.attr("opacity", (n) => (near.has(n.id) ? 1 : 0.16));
    label.attr("opacity", (n) => (near.has(n.id) ? 1 : 0.06));
    link.attr("stroke", (e) => (touches(e) ? "rgba(125,153,255,.9)" : "rgba(255,255,255,.05)"))
      .attr("stroke-width", (e) => (touches(e) ? 2 : 1));
  }

  let clickTimer = null;
  node
    .on("mouseenter focus", (ev, d) => {
      if (d.orphan && !filters.showOrphans) return;
      highlight(d);
      if (pinnedId == null) showCard(d);
    })
    .on("mouseleave blur", () => {
      const pinned = pinnedId != null ? nodeMap.get(pinnedId) : null;
      highlight(pinned);
      if (pinned) showCard(pinned); else hideCard();
    })
    .on("click", (ev, d) => {
      ev.stopPropagation();
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => { pinnedId = d.id; highlight(d); showCard(d); }, 220);
    })
    .on("dblclick", (ev, d) => { ev.stopPropagation(); clearTimeout(clickTimer); openNote(d.id); })
    .on("keydown", (ev, d) => {
      if (ev.key === "Enter") openNote(d.id);
      if (ev.key === " ") { ev.preventDefault(); pinnedId = d.id; highlight(d); showCard(d); }
    });

  svg.on("click", () => { pinnedId = null; highlight(null); hideCard(); });

  simulation.on("tick", () => {
    link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
    linkLabel?.attr("x", (d) => (d.source.x + d.target.x) / 2).attr("y", (d) => (d.source.y + d.target.y) / 2);
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  view = { svg, g, W, H };
  let fitted = false;
  const fitOnce = () => { if (!fitted) { fitted = true; fitGraph(); } };
  simulation.on("end", fitOnce);
  setTimeout(fitOnce, 2600);
}

function fitGraph() {
  if (!view || !currentNodeData.length) return;
  const pts = currentNodeData.filter((n) => Number.isFinite(n.x) && Number.isFinite(n.y));
  if (!pts.length) return;
  const xs = pts.map((n) => n.x);
  const ys = pts.map((n) => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = Math.min(100, view.W * 0.12, view.H * 0.12);
  const scale = Math.min((view.W - pad * 2) / (maxX - minX || 1), (view.H - pad * 2) / (maxY - minY || 1), 1.1);
  const tx = view.W / 2 - ((minX + maxX) / 2) * scale;
  const ty = view.H / 2 - ((minY + maxY) / 2) * scale;
  view.svg.transition().duration(650).ease(d3.easeCubicOut)
    .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}

// ── Note card ──
function showCard(d) {
  document.getElementById("nc-dot").style.background = d.id === focusId ? "#ffffff" : colorFor(d);
  document.getElementById("nc-title").textContent = d.title;
  const meta = [spaceName(d) || "No Space", ...(d.tags || []).slice(0, 3).map((t) => `#${t}`)];
  document.getElementById("nc-meta").textContent = meta.join(" · ");
  document.getElementById("nc-snippet").textContent = d.snippet || "";

  const neighbors = currentLinkData
    .filter((e) => idOf(e.source) === d.id || idOf(e.target) === d.id)
    .map((e) => ({ other: idOf(e.source) === d.id ? e.target : e.source, edge: e }))
    .filter((x) => x.other && x.other.id !== d.id);
  const conns = document.getElementById("nc-conns");
  conns.innerHTML = neighbors.length
    ? `<div class="nc-conns-label">LINKED (${neighbors.length})</div>` + neighbors.slice(0, 6).map(({ other, edge }) => `
        <button class="nc-conn" type="button" data-nid="${other.id}">
          <span class="chip-dot" style="background:${other.id === focusId ? "#ffffff" : colorFor(other)}"></span>
          <span>${escapeHtml(other.title)}</span>
          <small>${escapeHtml(edgeLabel(edge))}</small>
        </button>`).join("")
    : "";
  conns.querySelectorAll(".nc-conn").forEach((btn) => {
    btn.addEventListener("click", () => { focusId = Number(btn.dataset.nid); renderGraph(); });
  });

  document.getElementById("nc-open").onclick = () => openNote(d.id);
  const focusBtn = document.getElementById("nc-focus");
  focusBtn.hidden = d.id === focusId;
  focusBtn.onclick = () => { focusId = d.id; renderGraph(); };
  document.getElementById("nc-hint").textContent = pinnedId === d.id
    ? "Double-click a node to open it."
    : "Click to keep this card open.";
  card.classList.add("show");
}

function hideCard() { card.classList.remove("show"); }

// ── Controls ──
function toggleFilters(force) {
  const open = filterPanel.classList.toggle("open", force);
  btnFilters.classList.toggle("active", open);
  btnFilters.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) document.getElementById("fp-note-search").focus({ preventScroll: true });
}
btnFilters.addEventListener("click", () => toggleFilters());
document.getElementById("mobile-filters").addEventListener("click", () => toggleFilters());
document.getElementById("btn-reset-zoom").addEventListener("click", fitGraph);
document.getElementById("mobile-fit").addEventListener("click", fitGraph);
document.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape") return;
  if (filterPanel.classList.contains("open")) toggleFilters(false);
  else { pinnedId = null; hideCard(); }
});

function bindSlider(id, valId, format, key, redraw) {
  const el = document.getElementById(id);
  const out = document.getElementById(valId);
  el.addEventListener("input", () => {
    filters[key] = Number(el.value);
    out.textContent = format(filters[key]);
    if (redraw && focusId) renderGraph();
    else if (view) view.svg.call(zoomBehavior.transform, d3.zoomTransform(view.svg.node()));
  });
}
bindSlider("sl-depth", "val-depth", (v) => v, "depth", true);
bindSlider("sl-node-size", "val-node-size", (v) => `${v}×`, "nodeSizeMul", true);
bindSlider("sl-text-fade", "val-text-fade", (v) => v, "textFade", false);
bindSlider("sl-repulsion", "val-repulsion", (v) => v, "repulsion", true);

function bindToggle(id, key) {
  document.getElementById(id).addEventListener("change", (ev) => {
    filters[key] = ev.target.checked;
    if (focusId) renderGraph();
  });
}
bindToggle("tog-orphans", "showOrphans");
bindToggle("tog-link-labels", "showLinkLabels");

document.getElementById("fp-note-search").addEventListener("keydown", (ev) => {
  if (ev.key !== "Enter") return;
  const q = ev.target.value.trim().toLowerCase();
  const match = q && ALL_NODES.find((n) => n.title.toLowerCase().includes(q));
  if (match) { focusId = match.id; ev.target.value = ""; toggleFilters(false); renderGraph(); }
});

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (focusId) renderGraph(); }, 180);
});

document.querySelectorAll("[data-internal-app-link]").forEach((a) => {
  a.addEventListener("click", () => sessionStorage.setItem("edge_note_internal_navigation_v1", "1"));
});

loadGraph().catch((err) => {
  loading.innerHTML = "";
  const msg = document.createElement("div");
  msg.style.cssText = "color:#f08a7e;font-size:13px;padding:20px";
  msg.textContent = `Could not load the graph: ${err.message}`;
  loading.append(msg);
});
