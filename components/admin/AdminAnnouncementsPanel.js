"use client";
import { useEffect, useState } from "react";

const LEVELS = [["info", "News"], ["promo", "Offer"], ["warning", "Warning"]];
const input = "w-full rounded-lg bg-bgDeep border border-lineColor px-3 py-2 text-sm text-textLight placeholder:text-textDim/60";

// Create, show/hide and delete the banner that appears at the top of every page.
export default function AdminAnnouncementsPanel() {
  const [list, setList] = useState(null);
  const [f, setF] = useState({ message: "", level: "info", link_url: "", link_label: "", starts_at: "", ends_at: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function load() { const r = await fetch("/api/admin/announcements"); const d = await r.json(); if (!r.ok) setErr(d.error || "Couldn't load announcements."); else setList(d.announcements); }
  useEffect(() => { load(); }, []);
  async function create(e) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await fetch("/api/admin/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }); const d = await r.json();
    setBusy(false); if (!r.ok) return setErr(d.error || "Couldn't publish."); setF({ message: "", level: "info", link_url: "", link_label: "", starts_at: "", ends_at: "" }); load();
  }
  async function toggle(a) { await fetch("/api/admin/announcements", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id, is_active: !a.is_active }) }); load(); }
  async function del(a) { if (!confirm("Delete this announcement?")) return; await fetch("/api/admin/announcements", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id }) }); load(); }
  const now = Date.now();
  const state = (a) => !a.is_active ? "Hidden" : new Date(a.starts_at) > now ? "Scheduled" : a.ends_at && new Date(a.ends_at) < now ? "Ended" : "Live";
  return (
    <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
      <form onSubmit={create} className="ap-card p-5 space-y-3">
        <h2 className="font-display font-bold text-lg">New announcement</h2>
        <label className="block text-xs text-textDim">Message (shown to every visitor)<textarea required maxLength={300} rows={3} className={input + " mt-1"} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Navratri is live in Midnight Burn. Come race the festival." /></label>
        <div className="flex gap-2">{LEVELS.map(([k, l]) => <button type="button" key={k} onClick={() => setF({ ...f, level: k })} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={f.level === k ? { background: "#3ee6e0", color: "#07151a" } : { background: "rgba(255,255,255,0.06)", color: "#cfc8f2" }}>{l}</button>)}</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-textDim">Link (optional)<input className={input + " mt-1"} value={f.link_url} onChange={(e) => setF({ ...f, link_url: e.target.value })} placeholder="/pricing or https://…" /></label>
          <label className="text-xs text-textDim">Link text<input className={input + " mt-1"} maxLength={40} value={f.link_label} onChange={(e) => setF({ ...f, link_label: e.target.value })} placeholder="See pricing" /></label>
          <label className="text-xs text-textDim">Starts (optional)<input type="datetime-local" className={input + " mt-1"} value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></label>
          <label className="text-xs text-textDim">Ends (optional)<input type="datetime-local" className={input + " mt-1"} value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} /></label>
        </div>
        {err && <p className="text-sm text-accentMagenta">{err}</p>}
        <button disabled={busy} className="ap-btn ap-btn-primary text-sm disabled:opacity-50">{busy ? "Publishing…" : "Publish announcement"}</button>
        <p className="text-xs text-textDim">Only the newest live announcement is shown. Visitors can close it.</p>
      </form>
      <div className="space-y-3">
        <h2 className="font-display font-bold text-lg">History</h2>
        {list === null && <p className="text-sm text-textDim">Loading…</p>}
        {list && list.length === 0 && <p className="text-sm text-textDim">No announcements yet. Write one on the left.</p>}
        {(list || []).map((a) => (
          <div key={a.id} className="ap-card p-4">
            <div className="flex items-center gap-2 mb-1.5"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: state(a) === "Live" ? "rgba(62,230,224,0.16)" : "rgba(255,255,255,0.08)", color: state(a) === "Live" ? "#3ee6e0" : "#a99fd6" }}>{state(a)}</span><span className="text-[11px] text-textDim">{new Date(a.created_at).toLocaleString()}</span></div>
            <p className="text-sm">{a.message}</p>
            <div className="flex gap-2 mt-3"><button onClick={() => toggle(a)} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10">{a.is_active ? "Hide" : "Show"}</button><button onClick={() => del(a)} className="text-xs px-3 py-1.5 rounded-lg text-accentMagenta bg-accentMagenta/10 hover:bg-accentMagenta/20">Delete</button></div>
          </div>
        ))}
      </div>
    </div>
  );
}
