// EDGE Note service worker: lets the app open without a connection.
//
// - Pages (/, /graph.html, /capture.html) are network-first: the live site
//   always wins when it answers, so a deploy is never hidden behind an old
//   copy. The saved copy is used only when the network fails or stalls.
// - Versioned files (app.vN.js, styles.vN.css, fonts) never change, so they
//   are served from the saved copy first. Old versions are pruned whenever a
//   fresh page shows which ones are current.
// - Attachments the user has opened are kept for offline viewing.
// - All other /api requests are left alone; the app has its own offline layer.
//
// Bump VERSION only to throw away every saved copy (e.g. a format change).
const VERSION = "v1";
const PAGES_CACHE = `edge-pages-${VERSION}`;
const ASSETS_CACHE = `edge-assets-${VERSION}`;
const ATTACH_CACHE = `edge-attachments-${VERSION}`;
const PAGES = ["/", "/graph.html", "/capture.html"];
const EXTRAS = ["/manifest.webmanifest", "/lucide-sprite.svg", "/edge-note-mark.v3.svg", "/edge-note-icon-v3-192.png", "/edge-note-icon-v3-512.png"];
const NETWORK_TIMEOUT_MS = 6000;
const MAX_ATTACHMENTS = 300;

const isImmutable = (path) => /\.v\d+\.(js|css)$/.test(path) || /\.woff2$/.test(path);
const pageKey = (url) => (PAGES.includes(url.pathname) ? url.pathname : url.pathname === "/index.html" ? "/" : url.pathname);

// Local files a page or file pulls in: <script src>, <link href>, CSS url(),
// and ES module imports.
function references(text) {
  const refs = new Set();
  const patterns = [
    /(?:src|href)=["'](\/[^"'#?]+)["']/g,
    /url\(\s*["']?(\/[^"')?#]+)["']?\s*\)/g,
    /(?:import|from)\s*\(?\s*["'](\/[^"']+)["']/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) refs.add(match[1]);
  }
  return [...refs].filter((ref) => !ref.startsWith("/api/"));
}

// Save a page's files (and the files those pull in), returning every path seen.
async function cacheFilesOf(html) {
  const cache = await caches.open(ASSETS_CACHE);
  const seen = new Set();
  const queue = references(html);
  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    if (!/\.(js|css|woff2|svg|png|webmanifest)$/.test(path)) continue;
    let response = isImmutable(path) ? await cache.match(path) : null;
    if (!response) {
      try {
        response = await fetch(path, { credentials: "same-origin" });
        if (!response.ok) continue;
        await cache.put(path, response.clone());
      } catch {
        continue;
      }
    }
    if (/\.(js|css)$/.test(path)) {
      const text = await response.clone().text().catch(() => "");
      references(text).forEach((ref) => { if (!seen.has(ref)) queue.push(ref); });
    }
  }
  return seen;
}

// Drop versioned files no saved page uses any more.
async function pruneAssets() {
  const pages = await caches.open(PAGES_CACHE);
  const keep = new Set(EXTRAS);
  for (const request of await pages.keys()) {
    const response = await pages.match(request);
    const html = response ? await response.text().catch(() => "") : "";
    (await cacheFilesOf(html)).forEach((path) => keep.add(path));
  }
  const assets = await caches.open(ASSETS_CACHE);
  for (const request of await assets.keys()) {
    const url = new URL(request.url);
    if (url.origin === self.location.origin && isImmutable(url.pathname) && !keep.has(url.pathname)) {
      await assets.delete(request);
    }
  }
}

async function refreshPage(path) {
  const response = await fetch(path, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok || response.type !== "basic") return response;
  const pages = await caches.open(PAGES_CACHE);
  await pages.put(path, response.clone());
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const assets = await caches.open(ASSETS_CACHE);
    await Promise.all(EXTRAS.map((path) => assets.add(path).catch(() => {})));
    for (const path of PAGES) {
      try {
        const response = await refreshPage(path);
        if (response.ok) await cacheFilesOf(await response.clone().text());
      } catch {}
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const current = new Set([PAGES_CACHE, ASSETS_CACHE, ATTACH_CACHE]);
    for (const key of await caches.keys()) {
      if (key.startsWith("edge-") && !current.has(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

async function pageResponse(event, url) {
  const key = pageKey(url);
  const network = fetch(event.request).then(async (response) => {
    if (response.ok && response.type === "basic") {
      const pages = await caches.open(PAGES_CACHE);
      await pages.put(key, response.clone());
      // Keep the files this version of the page needs, then drop old ones.
      event.waitUntil(response.clone().text().then(cacheFilesOf).then(pruneAssets).catch(() => {}));
    }
    return response;
  });
  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch {
    const cached = await caches.match(key, { cacheName: PAGES_CACHE });
    if (cached) return cached;
    return network.catch(() => new Response(
      "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><title>EDGE Note</title>"
      + "<body style='margin:0;display:grid;place-items:center;height:100vh;background:#0b1524;color:#e9edf5;font:16px system-ui;text-align:center;padding:24px'>"
      + "<div><p style='font-size:20px;margin:0 0 8px'>You're offline</p><p style='margin:0;color:#a3aec0'>Open EDGE Note once while connected and it will work offline after that.</p></div>",
      { status: 503, headers: { "content-type": "text/html; charset=utf-8" } }
    ));
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request, { cacheName });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && (response.type === "basic" || response.type === "cors")) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { cacheName });
    if (cached) return cached;
    throw error;
  }
}

async function attachmentResponse(request) {
  const cache = await caches.open(ATTACH_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    // Oldest first: trim to the most recent MAX_ATTACHMENTS.
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_ATTACHMENTS))) await cache.delete(old);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/attachments/")) { event.respondWith(attachmentResponse(request)); return; }
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/__capture/") || url.pathname === "/sw.js") return;
    if (request.mode === "navigate" || PAGES.includes(url.pathname)) { event.respondWith(pageResponse(event, url)); return; }
    if (isImmutable(url.pathname)) { event.respondWith(cacheFirst(request, ASSETS_CACHE)); return; }
    event.respondWith(networkFirst(request, ASSETS_CACHE));
    return;
  }

  // The graph's d3 bundle (pinned version, so it never changes).
  if (url.hostname === "cdn.jsdelivr.net") event.respondWith(cacheFirst(request, ASSETS_CACHE));
});
