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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[92vw] max-w-sm rounded-xl border border-accentCyan bg-bgPanel shadow-2xl p-4">
      <p className="font-mono text-xs text-textLight mb-3">
        ⚡ A newer version of the site is ready. Finish what you're doing — refresh whenever you like.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => window.location.reload()}
          className="font-pixel text-[10px] px-4 py-2 rounded-md bg-accentCyan text-bgDeep flex-1"
        >
          REFRESH NOW
        </button>
        <button
          onClick={() => setUpdateAvailable(false)}
          className="font-mono text-[10px] px-4 py-2 rounded-md border border-lineColor text-textDim"
        >
          Later
        </button>
      </div>
    </div>
  );
}
