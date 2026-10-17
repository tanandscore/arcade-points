"use client";

import { useEffect, useState } from "react";

export default function AdminSiteSettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [countdownDraft, setCountdownDraft] = useState("");
  const [countdownLabelDraft, setCountdownLabelDraft] = useState("");

  // datetime-local inputs need "YYYY-MM-DDTHH:mm" in the browser's
  // local time, with no timezone suffix — different enough from the
  // UTC ISO string Postgres returns that it needs real conversion,
  // not just a slice.
  function isoToLocalInput(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function load() {
    setError("");
    const res = await fetch("/api/admin/site-settings");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Couldn't load site settings.");
      return;
    }
    setSettings(data.settings);
    setMessageDraft(data.settings.maintenance_message);
    setCountdownDraft(isoToLocalInput(data.settings.launch_countdown_at));
    setCountdownLabelDraft(data.settings.launch_countdown_label || "Launch");
  }

  useEffect(() => {
    load();
  }, []);

  async function update(updates) {
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/site-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't save.");
      return;
    }
    setSettings(data.settings);
  }

  if (!settings) {
    return <p className="font-mono text-xs text-textDim">{error || "Loading..."}</p>;
  }

  return (
    <div className="rounded-xl border border-lineColor bg-bgPanel p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <p className="font-mono text-xs text-textLight">
          {settings.maintenance_mode ? "🛠️ Maintenance mode is ON" : "🟢 Site is live"}
        </p>
        <button
          onClick={() => update({ maintenance_mode: !settings.maintenance_mode })}
          disabled={saving}
          className="font-mono text-[10px] px-4 py-2 rounded-md disabled:opacity-50"
          style={{ background: settings.maintenance_mode ? "#6bff6b" : "#ff3ea5", color: "#0a0616" }}
        >
          {settings.maintenance_mode ? "Turn off — go live" : "Turn on maintenance"}
        </button>
      </div>
      {settings.maintenance_mode && (
        <p className="font-mono text-[10px] text-accentAmber mb-4">
          Every non-admin visitor is being redirected to /maintenance right now. You can still reach the whole site
          normally.
        </p>
      )}
      <label className="font-mono text-[10px] text-textDim block mb-1">Message shown on the maintenance page</label>
      <div className="flex gap-2">
        <textarea
          value={messageDraft}
          onChange={(e) => setMessageDraft(e.target.value)}
          rows={2}
          maxLength={500}
          className="flex-1 bg-bgDeep border border-lineColor rounded-md px-2.5 py-2 font-mono text-xs text-textLight resize-none"
        />
        <button
          onClick={() => update({ maintenance_message: messageDraft })}
          disabled={saving || messageDraft.trim() === settings.maintenance_message}
          className="font-mono text-[10px] px-3 rounded-md border border-lineColor text-textDim disabled:opacity-40 self-start"
        >
          Save
        </button>
      </div>
      {error && <p className="font-mono text-[10px] text-accentMagenta mt-2">{error}</p>}

      <hr className="border-lineColor my-5" />

      <p className="font-mono text-xs text-textLight mb-1">Launch countdown</p>
      <p className="font-mono text-[10px] text-textDim mb-3">
        {settings.launch_countdown_at && new Date(settings.launch_countdown_at) > new Date()
          ? `Active — gameplay unlocks ${new Date(settings.launch_countdown_at).toLocaleString()}. Browsing and signup stay open the whole time.`
          : "No countdown running — gameplay is open right now."}
      </p>
      <div className="flex flex-wrap gap-2 mb-2">
        <input
          type="datetime-local"
          value={countdownDraft}
          onChange={(e) => setCountdownDraft(e.target.value)}
          className="bg-bgDeep border border-lineColor rounded-md px-2.5 py-2 font-mono text-xs text-textLight"
        />
        <input
          type="text"
          value={countdownLabelDraft}
          onChange={(e) => setCountdownLabelDraft(e.target.value)}
          placeholder="Label (e.g. Grand Launch)"
          maxLength={100}
          className="bg-bgDeep border border-lineColor rounded-md px-2.5 py-2 font-mono text-xs text-textLight"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => update({ launch_countdown_at: countdownDraft ? new Date(countdownDraft).toISOString() : null, launch_countdown_label: countdownLabelDraft })}
          disabled={saving || !countdownDraft}
          className="font-mono text-[10px] px-3 py-2 rounded-md border border-accentCyan text-accentCyan disabled:opacity-40"
        >
          Set countdown
        </button>
        <button
          onClick={() => {
            setCountdownDraft("");
            update({ launch_countdown_at: null });
          }}
          disabled={saving || !settings.launch_countdown_at}
          className="font-mono text-[10px] px-3 py-2 rounded-md border border-lineColor text-textDim disabled:opacity-40"
        >
          Clear countdown
        </button>
      </div>
    </div>
  );
}
