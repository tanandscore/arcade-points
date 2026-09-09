"use client";

import { useEffect, useState } from "react";

export default function MaintenanceClient({ from }) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(false);

  async function checkStatus() {
    setChecking(true);
    setError(false);
    try {
      const res = await fetch("/api/maintenance-status", { cache: "no-store" });
      const data = await res.json();
      if (!data.maintenanceMode) {
        // `from` comes from a URL query param — the middleware only
        // ever sets it to a real internal path, but this page is
        // itself exempt from the maintenance redirect, so someone
        // could visit /maintenance?from=https://evil.com directly.
        // Only ever redirect to a genuine same-site relative path —
        // starts with exactly one "/", never "//" (browsers treat
        // that as protocol-relative, i.e. an external redirect).
        const safeTarget = typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from : "/dashboard";
        window.location.href = safeTarget;
        return;
      }
    } catch {
      setError(true);
    }
    setChecking(false);
  }

  useEffect(() => {
    // Checks once immediately, in case maintenance already ended
    // before this page even finished loading, then keeps polling —
    // nobody should have to know to manually refresh to get back in.
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="rounded-md border border-accentCyan/40 bg-accentCyan/10 p-3 mt-5 mb-5 text-left">
        <p className="font-mono text-[10px] text-accentCyan leading-relaxed">
          Your game progress is saved — you'll be taken right back to what you were doing the moment we're back.
          Games with save support (like Kingdoms of Ash) pick up exactly where you left off.
        </p>
      </div>
      <button
        onClick={checkStatus}
        disabled={checking}
        className="font-mono text-[10px] px-4 py-2 rounded-md border border-lineColor text-textLight disabled:opacity-50"
      >
        {checking ? "Checking..." : "Check now"}
      </button>
      <p className="font-mono text-[9px] text-textDim mt-3">
        {error ? "Couldn't reach the server — we'll keep trying automatically." : "Checking automatically every 15 seconds."}
      </p>
    </div>
  );
}
