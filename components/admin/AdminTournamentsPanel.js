"use client";

import { useEffect, useState } from "react";

const DUEL_GAMES = ["grandprixduel", "territoryduel"];

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyForm() {
  return { name: "", description: "", starts_at: "", ends_at: "", game_slugs: [], announcement: "", require_tournament_entry: false };
}

export default function AdminTournamentsPanel() {
  const [tournaments, setTournaments] = useState(null);
  const [games, setGames] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null); // null = creating new
  const [saving, setSaving] = useState(false);

  async function load() {
    setError("");
    const [tRes, gRes] = await Promise.all([fetch("/api/admin/tournaments"), fetch("/api/admin/games")]);
    const tData = await tRes.json();
    const gData = await gRes.json();
    if (!tRes.ok) {
      setError(tData.error || "Couldn't load tournaments.");
      return;
    }
    setTournaments(tData.tournaments);
    setGames(gData.games || []);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(t) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      description: t.description || "",
      starts_at: toLocalInput(t.starts_at),
      ends_at: toLocalInput(t.ends_at),
      game_slugs: t.game_slugs || [],
      announcement: t.announcement || "",
      require_tournament_entry: t.require_tournament_entry === true,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function toggleGame(slug) {
    setForm((f) => ({
      ...f,
      game_slugs: f.game_slugs.includes(slug) ? f.game_slugs.filter((s) => s !== slug) : [...f.game_slugs, slug],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : "",
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : "",
    };
    const res = await fetch(editingId ? `/api/admin/tournaments/${editingId}` : "/api/admin/tournaments", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't save tournament.");
      return;
    }
    cancelEdit();
    load();
  }

  async function remove(id) {
    setError("");
    const res = await fetch(`/api/admin/tournaments/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Couldn't delete.");
      return;
    }
    load();
  }

  // The softer alternative to Delete — hides a past tournament from
  // the public Past Winners list on /tournaments without touching its
  // underlying data (standings, scores). Only meaningful once a
  // tournament has actually ended.
  async function toggleWinnersVisibility(t) {
    setError("");
    const res = await fetch(`/api/admin/tournaments/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show_in_winners_list: !t.show_in_winners_list }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Couldn't update.");
      return;
    }
    load();
  }

  if (!tournaments || !games) {
    return <p className="font-mono text-xs text-textDim">{error || "Loading..."}</p>;
  }

  const statusColor = { upcoming: "#ffb703", active: "#6bff6b", ended: "#a99fd6" };

  return (
    <div>
      <form onSubmit={submit} className="rounded-xl border border-lineColor p-5 bg-bgPanel mb-8">
        <h2 className="font-pixel text-[10px] text-accentCyan mb-4">{editingId ? "EDIT TOURNAMENT" : "NEW TOURNAMENT"}</h2>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Tournament name"
            maxLength={120}
            className="rounded-md px-3 py-2.5 outline-none text-sm bg-bgDeep border border-lineColor text-textLight sm:col-span-2"
          />
          <div>
            <label className="font-mono text-[9px] text-textDim block mb-1">Starts</label>
            <input
              type="datetime-local"
              required
              value={form.starts_at}
              onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
              className="w-full rounded-md px-3 py-2.5 outline-none text-sm bg-bgDeep border border-lineColor text-textLight"
            />
          </div>
          <div>
            <label className="font-mono text-[9px] text-textDim block mb-1">Ends</label>
            <input
              type="datetime-local"
              required
              value={form.ends_at}
              onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
              className="w-full rounded-md px-3 py-2.5 outline-none text-sm bg-bgDeep border border-lineColor text-textLight"
            />
          </div>
        </div>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Short description shown on the tournament page"
          rows={2}
          maxLength={1000}
          className="w-full rounded-md px-3 py-2.5 outline-none text-sm bg-bgDeep border border-lineColor text-textLight mb-3 resize-none"
        />
        <label className="font-mono text-[9px] text-textDim block mb-1.5">Games in this tournament</label>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {games.map((g) => (
            <button
              key={g.slug}
              type="button"
              onClick={() => toggleGame(g.slug)}
              className="font-mono text-[9px] px-2.5 py-1.5 rounded-md border"
              style={
                form.game_slugs.includes(g.slug)
                  ? { borderColor: "#3ee6e0", color: "#3ee6e0", background: "rgba(62,230,224,0.1)" }
                  : { borderColor: "rgba(169,159,214,0.3)", color: "#a99fd6" }
              }
            >
              {g.icon} {g.name} {DUEL_GAMES.includes(g.slug) && <span className="text-accentAmber">· PvP</span>}
            </button>
          ))}
        </div>
        <label className="font-mono text-[9px] text-textDim block mb-1">Announcement (optional, shown at the top of the tournament page)</label>
        <textarea
          value={form.announcement}
          onChange={(e) => setForm((f) => ({ ...f, announcement: e.target.value }))}
          rows={2}
          maxLength={1000}
          className="w-full rounded-md px-3 py-2.5 outline-none text-sm bg-bgDeep border border-lineColor text-textLight mb-4 resize-none"
        />
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={form.require_tournament_entry}
            onChange={(e) => setForm((f) => ({ ...f, require_tournament_entry: e.target.checked }))}
          />
          <span className="font-mono text-[10px] text-textDim">
            Lock these games to tournament-only play while this tournament is live — dashboard cards become
            unplayable directly, only reachable via this tournament's own Play Now link.
          </span>
        </label>
        {error && <p className="text-accentMagenta text-xs mb-3">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="font-pixel text-[10px] px-5 py-2.5 rounded-md bg-accentCyan text-bgDeep disabled:opacity-50">
            {saving ? "SAVING..." : editingId ? "SAVE CHANGES ▸" : "CREATE TOURNAMENT ▸"}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="font-mono text-[10px] px-4 py-2.5 rounded-md border border-lineColor text-textDim">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="rounded-xl border border-lineColor bg-bgPanel overflow-hidden">
        {tournaments.length === 0 && <p className="p-5 text-textDim text-sm">No tournaments yet.</p>}
        {tournaments.map((t) => (
          <div key={t.id} className="p-4 border-b border-lineColor last:border-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-textLight">
                  {t.name}{" "}
                  <span className="font-mono text-[9px] px-2 py-0.5 rounded-full border ml-1" style={{ borderColor: statusColor[t.status], color: statusColor[t.status] }}>
                    {t.status.toUpperCase()}
                  </span>
                </p>
                <p className="font-mono text-[10px] text-textDim mt-1">
                  {new Date(t.starts_at).toLocaleString()} → {new Date(t.ends_at).toLocaleString()}
                </p>
                <p className="font-mono text-[10px] text-textDim mt-1">{(t.game_slugs || []).length} game(s)</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => startEdit(t)} className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textLight">
                  Edit
                </button>
                {t.status === "ended" && (
                  <button
                    onClick={() => toggleWinnersVisibility(t)}
                    className="font-mono text-[10px] px-3 py-1.5 rounded-md border"
                    style={
                      t.show_in_winners_list === false
                        ? { borderColor: "rgba(169,159,214,0.3)", color: "#a99fd6" }
                        : { borderColor: "#3ee6e0", color: "#3ee6e0" }
                    }
                  >
                    {t.show_in_winners_list === false ? "Hidden from list" : "Shown in list"}
                  </button>
                )}
                <button onClick={() => remove(t.id)} className="font-mono text-[10px] px-3 py-1.5 rounded-md border text-accentMagenta" style={{ borderColor: "#ff3ea5" }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
