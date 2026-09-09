"use client";

import { useState } from "react";

export default function StreakEmailToggle({ initialOptOut }) {
  const [optOut, setOptOut] = useState(initialOptOut === true);
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    const next = !optOut;
    setOptOut(next); // optimistic — reverted below if the save fails
    setSaving(true);
    try {
      const res = await fetch("/api/account/streak-email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opt_out: next }),
      });
      if (!res.ok) setOptOut(!next);
    } catch {
      setOptOut(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-lineColor p-6 bg-bgPanel">
      <h2 className="font-pixel text-[10px] text-accentAmber mb-2">STREAK REMINDERS</h2>
      <p className="text-textDim text-xs mb-4">
        Get an email when your streak is about to break so you don&apos;t lose it by accident.
      </p>
      <label className="flex items-center gap-3 text-xs text-textLight cursor-pointer">
        <input type="checkbox" checked={!optOut} disabled={saving} onChange={handleToggle} className="w-4 h-4" />
        Email me when my streak is at risk
      </label>
    </div>
  );
}
