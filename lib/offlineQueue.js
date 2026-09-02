// Deliberately a small amount of duplicated IndexedDB logic with
// public/sw.js rather than sharing via import — a classic (non-ES-
// module) service worker script can't cleanly import from the app's
// module graph, and this file is tiny enough that duplicating it is
// the pragmatic, low-risk choice over adding a build step just to
// share ~20 lines.

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

// Called when a real fetch to /api/scores fails because the browser
// has no connectivity — stores the exact request so it can be
// replayed later, either by the service worker's Background Sync
// handler (where supported) or by tryReplayQueuedScores() below on
// next page load (everywhere else, notably Safari/iOS).
export async function queueScoreSubmission(url, bodyString) {
  const db = await openQueueDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add({ url, body: bodyString, queuedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  if ("serviceWorker" in navigator && "SyncManager" in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register("sync-pending-scores");
    } catch {
      // Background Sync registration failing just means the
      // page-load fallback below is what actually replays it later
    }
  }
}

export async function getQueuedScoreCount() {
  try {
    const db = await openQueueDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

// Fallback replay path for browsers without Background Sync support
// — called once on app load (see ServiceWorkerRegistration.js).
// Silently does nothing if there's nothing queued or still no
// connectivity.
export async function tryReplayQueuedScores() {
  let db;
  try {
    db = await openQueueDb();
  } catch {
    return;
  }
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
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(item.id);
      }
    } catch {
      // still offline — leave it queued for the next attempt
    }
  }
}
