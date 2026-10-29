"use client";

import { useEffect, useState } from "react";

// Cloudflare Workers deployments are already atomic — there's no
// window where the site is down or half-updated. The one real edge
// case in ANY Next.js app (on any host) is a user whose page loaded
// BEFORE a new deploy, who then navigates somewhere that needs a
// fresh JS chunk AFTER the deploy replaced it. That fetch fails.
// Without this guard, that shows up as a hard crash. With it, it's a
// calm, dismissible prompt — and critically, this never auto-reloads:
// someone mid-game keeps playing on the old code until they choose to
// refresh, so nothing is ever pulled out from under them.
const CHUNK_ERROR_PATTERNS = [
  /Loading chunk [\d]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /ChunkLoadError/i,
  /Importing a module script failed/i,
];

function isChunkError(message) {
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(message || ""));
}

export default function DeploymentGuard() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    function handleError(event) {
      const message = event?.error?.message || event?.message || "";
      if (isChunkError(message)) setUpdateAvailable(true);
    }
    function handleRejection(event) {
      const message = event?.reason?.message || String(event?.reason || "");
      if (isChunkError(message)) setUpdateAvailable(true);
    }
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="st-panel fixed bottom-20 left-1/2 z-[60] w-[92vw] max-w-sm -translate-x-1/2 p-4 shadow-2xl md:bottom-4" style={{ borderColor: "rgba(62,230,224,0.5)" }} role="status">
      <p className="mb-3 text-[14px] leading-relaxed text-[#f5f0ff]">
        A newer version of the site is ready. Finish what you&apos;re doing, then refresh whenever you like.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => window.location.reload()} className="st-btn st-btn-primary st-btn-sm flex-1">
          Refresh now
        </button>
        <button type="button" onClick={() => setUpdateAvailable(false)} className="st-btn st-btn-ghost st-btn-sm">
          Later
        </button>
      </div>
    </div>
  );
}
