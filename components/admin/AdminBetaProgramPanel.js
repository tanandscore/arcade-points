"use client";

import { useEffect, useState } from "react";

export default function AdminBetaProgramPanel() {
  const [program, setProgram] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [maxSlotsDraft, setMaxSlotsDraft] = useState("");
  const [durationDraft, setDurationDraft] = useState("");

  async function load() {
    setError("");
    const res = await fetch("/api/admin/beta-program");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Couldn't load the beta program.");
      return;
    }
    setProgram(data.program);
    setMaxSlotsDraft(String(data.program.max_slots));
    setDurationDraft(String(data.program.duration_days));
  }

  useEffect(() => {
    load();
  }, []);

  async function update(updates) {
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/beta-program", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't save changes.");
      return;
    }
    setProgram(data.program);
  }

  if (!program) {
    return <p className="font-mono text-xs text-textDim">{error || "Loading..."}</p>;
  }

  const slotsRemaining = Math.max(0, program.max_slots - program.slots_used);
  const pct = program.max_slots > 0 ? Math.min(100, Math.round((program.slots_used / program.max_slots) * 100)) : 0;

  return (
    <div className="rounded-xl border border-lineColor bg-bgPanel p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <p className="font-mono text-xs text-textLight">
            {program.is_active ? "🟢 Active" : "⚪ Off"} — {program.slots_used}/{program.max_slots} slots claimed
          </p>
          <p className="font-mono text-[10px] text-textDim mt-1">
            New signups automatically get {program.duration_days} days of free full access, until slots run out.
          </p>
        </div>
        <button
          onClick={() => update({ is_active: !program.is_active })}
          disabled={saving}
          className="font-mono text-[10px] px-4 py-2 rounded-md disabled:opacity-50"
          style={{ background: program.is_active ? "#ff3ea5" : "#3ee6e0", color: "#0a0616" }}
        >
          {program.is_active ? "Turn off" : "Turn on"}
        </button>
      </div>

      <div className="h-2 rounded-full bg-bgDeep border border-lineColor overflow-hidden mb-4">
        <div className="h-full bg-accentCyan" style={{ width: `${pct}%` }} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="font-mono text-[10px] text-textDim block mb-1">Total slots</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={maxSlotsDraft}
              onChange={(e) => setMaxSlotsDraft(e.target.value)}
              className="flex-1 bg-bgDeep border border-lineColor rounded-md px-2 py-1.5 font-mono text-xs text-textLight"
            />
            <button
              onClick={() => update({ max_slots: Number(maxSlotsDraft) })}
              disabled={saving || Number(maxSlotsDraft) === program.max_slots}
              className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
        <div>
          <label className="font-mono text-[10px] text-textDim block mb-1">Free days per beta user</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={durationDraft}
              onChange={(e) => setDurationDraft(e.target.value)}
              className="flex-1 bg-bgDeep border border-lineColor rounded-md px-2 py-1.5 font-mono text-xs text-textLight"
            />
            <button
              onClick={() => update({ duration_days: Number(durationDraft) })}
              disabled={saving || Number(durationDraft) === program.duration_days}
              className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <p className="font-mono text-[10px] text-textDim mt-4">
        {slotsRemaining > 0
          ? `${slotsRemaining} slots remaining. Changing the slot count or duration only affects future signups — anyone already enrolled keeps what they were granted.`
          : "All slots claimed. Raise the slot count above to reopen enrollment, or turn the program off."}
      </p>
      {error && <p className="font-mono text-[10px] text-accentMagenta mt-2">{error}</p>}
    </div>
  );
}
