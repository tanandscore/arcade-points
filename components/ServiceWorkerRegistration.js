"use client";

import { useEffect } from "react";
import { tryReplayQueuedScores } from "@/lib/offlineQueue";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failing (unsupported browser, blocked, etc.)
        // should never break the site — it just means this visit
        // won't have offline support, not that anything is broken.
      });
    }

    // Fallback replay path for browsers without Background Sync
    // (notably Safari/iOS) — any score that got queued offline
    // during a previous visit gets one retry attempt whenever the
    // app is opened again, connectivity permitting.
    tryReplayQueuedScores();
  }, []);

  return null;
}
