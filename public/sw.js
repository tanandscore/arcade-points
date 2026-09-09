// Plain, hand-written service worker — no build tooling (Workbox,
// next-pwa) is available in this environment to generate a precache
// manifest of Next.js's hashed asset filenames, so this uses runtime
// caching instead: assets get cached the first time they're actually
// requested, not preloaded in bulk upfront. That's a real, valid PWA
// pattern (used by plenty of production sites), just an honest one
// step down from full offline-first precaching.

const CACHE_VERSION = "v1";
const RUNTIME_CACHE = `tapandscore-runtime-${CACHE_VERSION}`;
const OFFLINE_FALLBACK_URL = "/offline";

// Deliberately a short, explicit allowlist — not "cache every API
// response." Most API routes return user-specific, sensitive, or
// fast-changing data that has no business being cached broadly.
// Achievements is the one client-side GET call the offline pages
// (dashboard, profile) actually depend on after their initial
// server-rendered load.
const OFFLINE_API_ALLOWLIST = ["/api/achievements"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(RUNTIME_CACHE).then((cache) => cache.add(OFFLINE_FALLBACK_URL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== RUNTIME_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // POSTs (score submissions etc.) are handled separately, see the sync logic below
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never intercept Supabase/Razorpay/etc.

  // Next.js's build output: hashed, immutable filenames — once
  // cached, always valid until the next deploy changes the hash.
  // This is also what makes repeat visits load instantly (the "fast
  // startup" goal), without needing to know those filenames ahead of
  // time.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (OFFLINE_API_ALLOWLIST.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) return cached;
  const fresh = await networkPromise;
  if (fresh) return fresh;
  return new Response(JSON.stringify({ achievements: [], offline: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

async function networkFirstWithOfflineFallback(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cachedPage = await cache.match(request);
    if (cachedPage) return cachedPage;
    const offlinePage = await cache.match(OFFLINE_FALLBACK_URL);
    if (offlinePage) return offlinePage;
    return new Response("You're offline, and this page hasn't been visited yet, so nothing is cached for it.", {
      headers: { "Content-Type": "text/plain" },
      status: 503,
    });
  }
}

// ------------------------------------------------------------
// Background Sync for score submissions made while offline.
// GameRunner.js queues a failed /api/scores POST into IndexedDB
// (see lib/offlineQueue.js) and registers this sync tag — the
// browser fires the "sync" event once connectivity genuinely
// returns, even if the tab isn't open. Background Sync isn't
// supported everywhere (notably Safari/iOS) — GameRunner.js also
// retries queued submissions on next page load as a fallback for
// browsers where this event never fires, so nothing is silently
// lost either way.
// ------------------------------------------------------------

const DB_NAME = "tapandscore-offline";
const STORE_NAME = "pending-scores";

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function replayQueuedScores() {
  const db = await openQueueDb();
  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: item.body,
      });
      if (res.ok) {
        const db2 = await openQueueDb();
        const tx = db2.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(item.id);
      }
    } catch {
      // still offline — leave it queued, the next sync/reload will try again
    }
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-pending-scores") {
    event.waitUntil(replayQueuedScores());
  }
});
