"use client";

import { useEffect, useState } from "react";

export default function AdminGamesPanel() {
  const [games, setGames] = useState(null);
  const [error, setError] = useState("");
  const [busySlug, setBusySlug] = useState(null);
  const [search, setSearch] = useState("");

  async function load() {
    setError("");
    const res = await fetch("/api/admin/games");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Couldn't load games.");
      return;
    }
    setGames(data.games);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(slug, field, currentValue) {
    setBusySlug(slug);
    const res = await fetch("/api/admin/games", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, [field]: !currentValue }),
    });
    const data = await res.json();
    setBusySlug(null);
    if (!res.ok) {
      setError(data.error || "Couldn't update.");
      return;
    }
    setGames((gs) => gs.map((g) => (g.slug === slug ? data.game : g)));
  }

  if (!games) {
    return <p className="font-mono text-xs text-textDim">{error || "Loading..."}</p>;
  }

  const filtered = games.filter((g) => g.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search games..."
        className="w-full rounded-md px-3 py-2.5 outline-none text-sm bg-bgDeep border border-lineColor text-textLight mb-4"
      />
      {error && <p className="font-mono text-[10px] text-accentMagenta mb-3">{error}</p>}
      <div className="rounded-xl border border-lineColor bg-bgPanel overflow-hidden">
        {filtered.map((g) => (
          <div key={g.slug} className="p-3.5 border-b border-lineColor last:border-0 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm text-textLight">
                {g.icon} {g.name}
                {g.admin_test_only && <span className="text-accentCyan text-[10px] ml-2">TEST ONLY</span>}
                {g.under_maintenance && <span className="text-accentAmber text-[10px] ml-2">MAINTENANCE</span>}
              </p>
              <p className="font-mono text-[10px] text-textDim">{g.category}</p>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => toggle(g.slug, "is_active", g.is_active)}
                disabled={busySlug === g.slug}
                className="font-mono text-[9px] px-2.5 py-1.5 rounded-md border disabled:opacity-40"
                style={{ borderColor: g.is_active ? "#6bff6b" : "#ff3ea5", color: g.is_active ? "#6bff6b" : "#ff3ea5" }}
              >
                {g.is_active ? "Live — click to hide" : "Hidden — click to show"}
              </button>
              <button
                onClick={() => toggle(g.slug, "admin_test_only", g.admin_test_only)}
                disabled={busySlug === g.slug}
                className="font-mono text-[9px] px-2.5 py-1.5 rounded-md border border-lineColor text-textDim disabled:opacity-40"
              >
                {g.admin_test_only ? "Make public" : "Make admin-only"}
              </button>
              <button
                onClick={() => toggle(g.slug, "under_maintenance", g.under_maintenance)}
                disabled={busySlug === g.slug}
                className="font-mono text-[9px] px-2.5 py-1.5 rounded-md border border-lineColor text-textDim disabled:opacity-40"
              >
                {g.under_maintenance ? "Clear maintenance" : "Mark under maintenance"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
