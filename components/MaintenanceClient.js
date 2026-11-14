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
      <div className="st-band mb-5 mt-6 px-4 py-3.5 text-left" style={{ borderColor: "rgba(62,230,224,0.35)", background: "rgba(62,230,224,0.08)" }}>
        <p className="text-[14px] leading-relaxed text-[#dcd5ff]">
          Your game progress is saved. You&apos;ll be taken right back to what you were doing the moment we&apos;re back.
          Games with save support pick up exactly where you left off.
        </p>
      </div>
      <button type="button" onClick={checkStatus} disabled={checking} className="st-btn st-btn-ghost st-btn-sm">
        {checking ? "Checking..." : "Check now"}
      </button>
      <p className="mt-3 text-[13px] text-[#a99fd6]">
        {error ? "Couldn't reach the server. We'll keep trying automatically." : "Checking automatically every 15 seconds."}
      </p>
    </div>
  );
}
