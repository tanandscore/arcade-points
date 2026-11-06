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
    <section className="st-panel p-5 sm:p-6" aria-labelledby="streak-h">
      <h2 id="streak-h" className="st-h3">Streak reminders</h2>
      <p className="st-muted text-[13.5px] mt-1.5 leading-relaxed">
        Get an email when your streak is about to break so you don&apos;t lose it by accident.
      </p>
      <label className="flex items-center gap-3 mt-4 text-[14.5px] text-[#f5f0ff] cursor-pointer">
        <input type="checkbox" checked={!optOut} disabled={saving} onChange={handleToggle} className="w-[18px] h-[18px] accent-[#3ee6e0]" />
        Email me when my streak is at risk
      </label>
    </section>
  );
}
