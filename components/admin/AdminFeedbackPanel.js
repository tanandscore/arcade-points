"use client";
import { useState } from "react";

const STATUS = [["new", "New"], ["reviewed", "Reviewed"], ["resolved", "Resolved"]];

// Feedback inbox with a status for each message, a private note, a filter and delete.
export default function AdminFeedbackPanel({ entries }) {
  const [rows, setRows] = useState(entries.map((e) => ({ ...e, status: e.status || "new", admin_note: e.admin_note || "" })));
  const [filter, setFilter] = useState("all");
  async function patch(id, body) { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...body } : r))); await fetch("/api/admin/feedback", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) }); }
  async function del(id) { if (!confirm("Delete this feedback for good?")) return; setRows((rs) => rs.filter((r) => r.id !== id)); await fetch("/api/admin/feedback", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); }
  if (!rows.length) return <p className="text-sm text-textDim">No feedback yet. When players send some, it shows up here.</p>;
  const shown = rows.filter((r) => filter === "all" || r.status === filter);
  return (
    <div>
      <div className="flex gap-1.5 mb-4">{[["all", `All (${rows.length})`], ...STATUS.map(([k, l]) => [k, `${l} (${rows.filter((r) => r.status === k).length})`])].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={filter === k ? { background: "#3ee6e0", color: "#07151a" } : { background: "rgba(255,255,255,0.06)", color: "#cfc8f2" }}>{l}</button>)}</div>
      <div className="space-y-3">
        {shown.map((e) => (
          <div key={e.id} className="ap-card p-4">
            <div className="flex justify-between text-xs text-textDim mb-2"><span>{e.profiles?.username || "player"}</span><span>{new Date(e.created_at).toLocaleString()}</span></div>
            <p className="text-sm whitespace-pre-wrap">{e.message}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {STATUS.map(([k, l]) => <button key={k} onClick={() => patch(e.id, { status: k })} className="text-xs px-2.5 py-1 rounded-lg" style={e.status === k ? { background: "rgba(62,230,224,0.18)", color: "#3ee6e0" } : { background: "rgba(255,255,255,0.05)", color: "#a99fd6" }}>{l}</button>)}
              <input defaultValue={e.admin_note} onBlur={(ev) => ev.target.value !== e.admin_note && patch(e.id, { admin_note: ev.target.value })} placeholder="Private note" className="flex-1 min-w-[140px] rounded-lg bg-bgDeep border border-lineColor px-2.5 py-1 text-xs" />
              <button onClick={() => del(e.id)} className="text-xs px-2.5 py-1 rounded-lg text-accentMagenta bg-accentMagenta/10">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
