"use client";
import { useEffect, useState } from "react";
import { GAME_MAPS } from "@/lib/gameMaps";

export default function MapSwitchboard() {
  const [off, setOff] = useState(null); const [busy, setBusy] = useState(""); const [msg, setMsg] = useState("");
  useEffect(() => { fetch("/api/admin/game-maps").then((r) => r.json()).then((d) => setOff(new Set((d.switches || []).filter((s) => !s.enabled).map((s) => s.game_slug + "/" + s.map_id)))).catch(() => setOff(new Set())); }, []);
  async function flip(slug, id, enabled) {
    setBusy(slug + "/" + id); setMsg("");
    const r = await fetch("/api/admin/game-maps", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, mapId: id, enabled }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setOff((p) => { const n = new Set(p); enabled ? n.delete(slug + "/" + id) : n.add(slug + "/" + id); return n; }); else setMsg(d.error || "Could not save.");
    setBusy("");
  }
  if (!off) return <p className="text-textDim text-sm">Loading…</p>;
  return (
    <div className="flex flex-col gap-6">
      {msg && <p className="text-sm text-accentPink">{msg}</p>}
      {Object.entries(GAME_MAPS).map(([slug, g]) => (
        <div key={slug} className="ap-glass rounded-2xl p-4">
          <p className="font-semibold mb-3">{g.name}</p>
          <div className="flex flex-col gap-2">
            {g.maps.map((m) => { const key = slug + "/" + m.id; const on = !off.has(key); return (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2">
                <div><p className="text-sm">{m.name}</p>{m.note && <p className="text-[11px] text-textDim">{m.note}</p>}</div>
                <button disabled={busy === key} onClick={() => flip(slug, m.id, !on)} className={"rounded-full px-4 py-1 text-xs font-semibold border " + (on ? "bg-green-500/20 border-green-400 text-green-300" : "bg-red-500/10 border-red-400/60 text-red-300")}>{on ? "ON" : "OFF"}</button>
              </div>); })}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-textDim">Run supabase/migration_076_game_maps.sql once before using this page. At least one map per game must stay on.</p>
    </div>
  );
}
