"use client";

import { useEffect, useMemo, useState } from "react";
import GameCard from "./GameCard";
import { SearchIcon, CloseIcon } from "./Icons";
import { GENRES } from "@/lib/catalog";

// Search, genre and sort for the browse page. The pass (Free / Power Pass / Legend Pass) is chosen with the tabs above, so it
// arrives here already decided (`tier`). Everything else lives in this component and is mirrored into the address bar, so a
// filtered view can be shared or bookmarked.
const SORTS = [
  ["recommended", "Recommended"],
  ["new", "Newest"],
  ["az", "A to Z"],
];

export default function BrowseView({ games, soon, tier = null, initial = {} }) {
  const [q, setQ] = useState(initial.q || "");
  const [genre, setGenre] = useState(initial.genre || "");
  const [sort, setSort] = useState(SORTS.some(([k]) => k === initial.sort) ? initial.sort : "recommended");

  const inTier = (g) => !tier || g.tier === tier;
  const pool = useMemo(() => [...games.filter(inTier), ...soon.filter(inTier)], [games, soon, tier]); // eslint-disable-line react-hooks/exhaustive-deps
  const genres = useMemo(() => GENRES.filter((g) => pool.some((x) => x.genre === g.id)), [pool]);

  // keep the address bar in step (no page load)
  useEffect(() => {
    try {
      const p = new URLSearchParams();
      if (tier) p.set("tier", tier);
      if (genre) p.set("genre", genre);
      if (q.trim()) p.set("q", q.trim());
      if (sort !== "recommended") p.set("sort", sort);
      const qs = p.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    } catch {}
  }, [tier, genre, q, sort]);

  const match = (g) => {
    if (!inTier(g)) return false;
    if (genre && g.genre !== genre) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [g.name, g.tagline, g.genre, g.style, ...(g.tags || [])].join(" ").toLowerCase().includes(s);
  };
  const order = (a, b) => {
    if (sort === "az") return a.name.localeCompare(b.name);
    if (sort === "new") return (b.added || "").localeCompare(a.added || "") || a.order - b.order;
    return a.order - b.order;
  };
  const live = games.filter(match).sort(order);
  const upcoming = soon.filter(match).sort(order);
  const filtered = !!(genre || q.trim());
  const clear = () => { setQ(""); setGenre(""); };

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">Search games</span>
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a99fd6] pointer-events-none"><SearchIcon size={18} /></span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, style or tag"
            className="h-11 w-full rounded-xl bg-white/[0.07] border border-white/15 pl-11 pr-10 text-[15px] placeholder:text-[#a99fd6] outline-none focus:border-accentCyan transition-colors"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[#c3bbea] hover:text-white hover:bg-white/10"><CloseIcon size={16} /></button>
          )}
        </label>
        <label className="flex items-center gap-2.5 text-[13.5px] st-muted shrink-0">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-11 rounded-xl bg-white/[0.07] border border-white/15 px-3 text-[14.5px] text-[#f5f0ff] outline-none focus:border-accentCyan">
            {SORTS.map(([k, l]) => <option key={k} value={k} className="bg-[#1d1046]">{l}</option>)}
          </select>
        </label>
      </div>

      {genres.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Genre">
          <button type="button" className="st-chip st-chip-btn !h-9 !px-4 !text-[13.5px]" aria-pressed={!genre} onClick={() => setGenre("")}>All genres</button>
          {genres.map((g) => (
            <button key={g.id} type="button" className="st-chip st-chip-btn !h-9 !px-4 !text-[13.5px]" style={{ "--tc": g.color }} aria-pressed={genre === g.id} onClick={() => setGenre(genre === g.id ? "" : g.id)}>
              {g.id}
            </button>
          ))}
        </div>
      )}

      <p className="st-muted text-[13.5px] mt-5" aria-live="polite">
        {live.length} {live.length === 1 ? "game" : "games"} to play now{upcoming.length > 0 ? `, ${upcoming.length} coming soon` : ""}
        {filtered && <button type="button" onClick={clear} className="st-link ml-3">Clear filters</button>}
      </p>

      {live.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 sm:gap-x-5 gap-y-7">
          {live.map((g, i) => <GameCard key={g.slug} game={g} showTier={!tier} priority={i < 4} />)}
        </div>
      ) : (
        <div className="st-band mt-4 px-6 py-12 text-center">
          <p className="st-h3">No games match that.</p>
          <p className="st-muted text-[14.5px] mt-1.5">Try a different word or pick another genre.</p>
          {filtered && <button type="button" onClick={clear} className="st-btn st-btn-sm st-btn-ghost mt-5">Clear filters</button>}
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mt-14" aria-labelledby="soon-h">
          <h2 id="soon-h" className="st-h2">Coming soon</h2>
          <p className="st-muted text-sm mt-1 mb-4">Announced and on the way. Open one to read about it and add it to your favourites.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 sm:gap-x-5 gap-y-7">
            {upcoming.map((g) => <GameCard key={g.slug} game={g} showTier={!tier} />)}
          </div>
        </section>
      )}
    </div>
  );
}
