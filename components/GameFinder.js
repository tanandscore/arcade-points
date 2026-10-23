"use client";
import { useEffect, useMemo, useState } from "react";
import GameCard from "./GameCard";

// Search, category filter and favourites for the dashboard. Favourites live in this browser only (localStorage).
// While a search/filter is active the normal dashboard sections (passed as children) are tucked away.
export default function GameFinder({ games, children }) {
  const [q, setQ] = useState(""); const [cat, setCat] = useState("All"); const [favs, setFavs] = useState([]); const [onlyFav, setOnlyFav] = useState(false); const [acc, setAcc] = useState("any"); // acc: any | free | paid
  useEffect(() => { try { setFavs(JSON.parse(localStorage.getItem("ts-favs") || "[]")); } catch {} }, []);
  const toggleFav = (slug) => setFavs((p) => { const n = p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]; try { localStorage.setItem("ts-favs", JSON.stringify(n)); } catch {} return n; });
  const CAT_RANK = { Arcade: 0, "Power Pass": 98, "Legend Pass": 99 }; // Arcade first, the paid passes last
  const cats = useMemo(() => [...new Set(games.map((g) => g.category))].sort((a, b) => (CAT_RANK[a] ?? 50) - (CAT_RANK[b] ?? 50)), [games]);
  const isPaid = (g) => !!g.price;
  const active = q.trim() !== "" || cat !== "All" || onlyFav || acc !== "any";
  const list = useMemo(() => { const s = q.trim().toLowerCase(); return games.filter((g) => (cat === "All" || g.category === cat) && (acc === "any" || (acc === "paid") === isPaid(g)) && (!onlyFav || favs.includes(g.slug)) && (!s || (g.name + " " + g.tagline + " " + g.category).toLowerCase().includes(s))); }, [games, q, cat, acc, onlyFav, favs]);
  const favGames = games.filter((g) => favs.includes(g.slug));
  const card = (g) => (
    <div key={g.slug} className="relative">
      <GameCard href={`/games/${g.slug}`} icon={g.icon} name={g.name} tagline={g.tagline} accentColor={g.accentColor} best={g.best} price={g.price} underMaintenance={g.underMaintenance} desktopOnly={g.desktopOnly} trending={g.trending} activeTournament={g.activeTournament} />
      <button type="button" aria-label={favs.includes(g.slug) ? `Remove ${g.name} from favourites` : `Add ${g.name} to favourites`} aria-pressed={favs.includes(g.slug)} onClick={() => toggleFav(g.slug)} className="absolute bottom-[4.5rem] right-3 z-10 w-8 h-8 rounded-full bg-bgPanel/90 border border-lineColor text-base leading-none hover:scale-110 transition-transform">{favs.includes(g.slug) ? "★" : "☆"}</button>
    </div>
  );
  return (
    <>
      <div className="mb-8">
        <div className="flex gap-2 flex-wrap items-center">
          <label className="flex-1 min-w-[200px]"><span className="sr-only">Search games</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search games…" className="w-full rounded-xl bg-bgPanel border border-lineColor px-4 py-2.5 text-sm outline-none focus:border-accentCyan" /></label>
          <button type="button" onClick={() => setOnlyFav((v) => !v)} aria-pressed={onlyFav} className={"rounded-xl border px-3 py-2.5 text-sm " + (onlyFav ? "border-gold text-gold" : "border-lineColor text-textDim")}>★ Favourites{favs.length ? ` (${favs.length})` : ""}</button>
        </div>
        <div className="flex gap-2 flex-wrap mt-3">
          {[["All", cat === "All" && acc === "any", () => { setCat("All"); setAcc("any"); }], ["Free", acc === "free", () => setAcc(acc === "free" ? "any" : "free")], ["Paid", acc === "paid", () => setAcc(acc === "paid" ? "any" : "paid")]].map(([c, on, fn]) => <button key={c} type="button" onClick={fn} aria-pressed={on} className={"font-mono text-[11px] px-3 py-1.5 rounded-full border " + (on ? (c === "Paid" ? "border-accentAmber text-accentAmber bg-accentAmber/10" : "border-accentCyan text-accentCyan bg-accentCyan/10") : "border-lineColor text-textDim")}>{c}</button>)}
          <span className="self-stretch w-px bg-lineColor mx-1" aria-hidden="true" />
          {cats.map((c) => <button key={c} type="button" onClick={() => setCat(cat === c ? "All" : c)} aria-pressed={cat === c} className={"font-mono text-[11px] px-3 py-1.5 rounded-full border " + (cat === c ? "border-accentCyan text-accentCyan bg-accentCyan/10" : "border-lineColor text-textDim")}>{c}</button>)}
        </div>
      </div>
      {active ? (
        <div className="mb-10">
          <p className="font-mono text-xs text-textDim mb-3">{list.length} game{list.length === 1 ? "" : "s"} found {onlyFav && !favs.length ? "— tap ☆ on a game to add favourites" : ""}</p>
          <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-4">{list.map(card)}</div>
          {!list.length && <p className="text-textDim text-sm">Nothing matches. Try another word or clear the filters.</p>}
        </div>
      ) : (
        <>
          {favGames.length > 0 && (
            <div className="mb-10"><h2 className="font-mono text-xs uppercase tracking-widest text-textDim mb-3">★ Your Favourites</h2>
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">{favGames.map((g) => <div key={g.slug} className="w-64 shrink-0">{card(g)}</div>)}</div></div>
          )}
          {children}
        </>
      )}
    </>
  );
}
