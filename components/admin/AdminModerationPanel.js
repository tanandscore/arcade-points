"use client";
import { useState } from "react";

const input = "rounded-lg bg-bgDeep border border-lineColor px-3 py-2 text-sm text-textLight placeholder:text-textDim/60";

// Look up a player, suspend or restore them, and remove a single score that looks wrong.
export default function AdminModerationPanel() {
  const [q, setQ] = useState(""); const [players, setPlayers] = useState(null); const [err, setErr] = useState(""); const [reason, setReason] = useState({});
  async function search(e) { e && e.preventDefault(); setErr(""); const r = await fetch("/api/admin/moderation?q=" + encodeURIComponent(q)); const d = await r.json(); if (!r.ok) return setErr(d.error || "Search failed."); setPlayers(d.players); }
  async function call(method, body) { const r = await fetch("/api/admin/moderation", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const d = await r.json(); if (!r.ok) setErr(d.error || "That didn't work."); else { setErr(""); search(); } }
  return (
    <div>
      <form onSubmit={search} className="flex gap-2 mb-6"><input className={input + " flex-1"} placeholder="Search a username (2+ letters)" value={q} onChange={(e) => setQ(e.target.value)} /><button className="ap-btn ap-btn-primary text-sm">Search</button></form>
      {err && <p className="text-sm text-accentMagenta mb-4">{err}</p>}
      {players && players.length === 0 && <p className="text-sm text-textDim">No player matches that name.</p>}
      <div className="space-y-4">
        {(players || []).map((p) => (
          <div key={p.id} className="ap-card p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-display font-bold text-lg">{p.username}</h3>
              {p.is_admin && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gold/15 text-gold">Admin</span>}
              {p.is_suspended && <span className="text-[11px] px-2 py-0.5 rounded-full bg-accentMagenta/15 text-accentMagenta">Suspended{p.suspended_reason ? `: ${p.suspended_reason}` : ""}</span>}
              <span className="text-xs text-textDim ml-auto">{p.country || "Country not set"} · joined {new Date(p.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {p.is_suspended
                ? <button onClick={() => call("POST", { userId: p.id, action: "unsuspend" })} className="text-xs font-semibold px-3 py-2 rounded-lg bg-accentCyan/15 text-accentCyan">Restore player</button>
                : <><input className={input + " text-xs"} placeholder="Reason (optional)" value={reason[p.id] || ""} onChange={(e) => setReason({ ...reason, [p.id]: e.target.value })} /><button disabled={p.is_admin} onClick={() => confirm(`Suspend ${p.username}? They won't be able to post scores.`) && call("POST", { userId: p.id, action: "suspend", reason: reason[p.id] })} className="text-xs font-semibold px-3 py-2 rounded-lg bg-accentMagenta/15 text-accentMagenta disabled:opacity-40">Suspend scores</button></>}
            </div>
            <div className="mt-4 overflow-x-auto">
              {p.scores.length === 0 ? <p className="text-sm text-textDim">No scores yet.</p> : (
                <table className="w-full text-sm"><thead><tr className="text-left text-xs text-textDim"><th className="py-1.5 font-medium">Game</th><th className="font-medium">Best score</th><th className="font-medium">Updated</th><th /></tr></thead>
                  <tbody>{p.scores.map((s) => (
                    <tr key={s.game} className="border-t border-lineColor/50"><td className="py-2">{s.game}</td><td className="font-mono text-gold">{s.score.toLocaleString()}</td><td className="text-xs text-textDim">{new Date(s.updated_at).toLocaleDateString()}</td>
                      <td className="text-right"><button onClick={() => confirm(`Remove ${p.username}'s ${s.game} score of ${s.score.toLocaleString()}?`) && call("DELETE", { userId: p.id, game: s.game })} className="text-xs px-2.5 py-1 rounded-lg text-accentMagenta bg-accentMagenta/10 hover:bg-accentMagenta/20">Remove</button></td></tr>))}</tbody></table>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
