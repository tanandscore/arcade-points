"use client";

import { useEffect, useState } from "react";

function emptyForm() {
  return { title: "", body: "", game_slug: "", published: false };
}

export default function AdminChangelogPanel() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  async function load() {
    setError("");
    const res = await fetch("/api/admin/changelog");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Couldn't load changelog entries.");
      return;
    }
    setEntries(data.entries);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setError("Title and body are both required.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/changelog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't save entry.");
      return;
    }
    setForm(emptyForm());
    load();
  }

  async function handleTogglePublished(entry) {
    const res = await fetch("/api/admin/changelog", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, published: !entry.published }),
    });
    if (res.ok) load();
  }

  async function handleDelete(id) {
    if (!confirm("Delete this changelog entry?")) return;
    const res = await fetch("/api/admin/changelog", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) load();
  }

  if (entries === null) {
    return <p className="text-textDim text-xs">Loading...</p>;
  }

  return (
    <div>
      {error && <p className="text-accentMagenta text-xs mb-3">{error}</p>}
      <form onSubmit={handleSubmit} className="rounded-xl border border-lineColor p-4 bg-bgPanel mb-6 space-y-3">
        <h3 className="font-pixel text-[10px] text-accentAmber mb-1">WRITE AN UPDATE</h3>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Title (e.g. Wrath of Olympus: 3 new enemy types)"
          className="w-full rounded-md px-3 py-2 text-xs bg-bgDeep border border-lineColor text-textLight font-mono"
        />
        <textarea
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          placeholder="What changed, in a couple sentences a player would actually care about"
          rows={3}
          className="w-full rounded-md px-3 py-2 text-xs bg-bgDeep border border-lineColor text-textLight font-mono"
        />
        <input
          value={form.game_slug}
          onChange={(e) => setForm({ ...form, game_slug: e.target.value })}
          placeholder="Game slug (optional — leave blank for a site-wide update)"
          className="w-full rounded-md px-3 py-2 text-xs bg-bgDeep border border-lineColor text-textLight font-mono"
        />
        <label className="flex items-center gap-2 text-[11px] text-textDim cursor-pointer">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
            className="w-3.5 h-3.5"
          />
          Publish immediately (otherwise saved as a hidden draft — publish it later from the list below)
        </label>
        <button
          type="submit"
          disabled={saving}
          className="font-mono text-[10px] px-4 py-2 rounded-md bg-accentAmber text-bgDeep"
        >
          {saving ? "Saving..." : form.published ? "Publish" : "Save as draft"}
        </button>
      </form>

      <div className="space-y-2">
        {entries.length === 0 && <p className="text-textDim text-xs">No changelog entries yet.</p>}
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-lg border border-lineColor p-3 bg-bgPanel flex justify-between items-start gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-textLight text-xs font-bold">{entry.title}</p>
                <span
                  className="font-mono text-[9px] px-1.5 py-0.5 rounded-md border"
                  style={
                    entry.published
                      ? { borderColor: "#3ee6e0", color: "#3ee6e0" }
                      : { borderColor: "rgba(169,159,214,0.4)", color: "#a99fd6" }
                  }
                >
                  {entry.published ? "LIVE" : "DRAFT"}
                </span>
              </div>
              <p className="text-textDim text-[11px] mt-1">{entry.body}</p>
              <p className="text-textDim text-[10px] mt-1">
                {entry.game_slug ? `${entry.game_slug} · ` : ""}
                {new Date(entry.published_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 items-end shrink-0">
              <button onClick={() => handleTogglePublished(entry)} className="font-mono text-[10px] text-accentCyan">
                {entry.published ? "Hide" : "Show"}
              </button>
              <button onClick={() => handleDelete(entry.id)} className="font-mono text-[10px] text-accentMagenta">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
