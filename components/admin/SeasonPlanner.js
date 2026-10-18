"use client";
import { useEffect, useMemo, useState } from "react";

const RULES = {
  standard: "Play any game in this week's lineup as many times as you like. Your best score in each game during the week counts. The top players on each game's leaderboard win.",
  focus: "One game, one week. Your best score in this week's featured game counts. Beat everyone on its leaderboard before the week ends.",
  duel: "Head-to-head week: challenge other players in the duel games. Every win during the week counts, and the player with the most wins takes first place.",
  custom: "",
};
const RULE_NAMES = { standard: "Best score wins (standard)", focus: "Featured game", duel: "Duel wins", custom: "Write my own" };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function nextDay(dow) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7 || 7)); return d; }

export default function SeasonPlanner() {
  const [games, setGames] = useState(null); const [existing, setExisting] = useState([]); const [err, setErr] = useState(""); const [done, setDone] = useState("");
  const [pool, setPool] = useState([]); const [mode, setMode] = useState("same"); const [perWeek, setPerWeek] = useState(3);
  const [weeks, setWeeks] = useState(26); const [dow, setDow] = useState(1); const [time, setTime] = useState("00:00"); const [days, setDays] = useState(7);
  const [first, setFirst] = useState(() => { const d = nextDay(1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; });
  const [nameT, setNameT] = useState("Weekly Showdown #{n}"); const [ruleKey, setRuleKey] = useState("standard"); const [rules, setRules] = useState(RULES.standard);
  const [announceT, setAnnounceT] = useState("Week {n} is live! Lineup: {games}. Good luck!"); const [exclusive, setExclusive] = useState(false);
  const [skip, setSkip] = useState({}); const [edits, setEdits] = useState({}); const [busy, setBusy] = useState(false);

  useEffect(() => { Promise.all([fetch("/api/admin/games").then((r) => r.json()), fetch("/api/admin/tournaments").then((r) => r.json())]).then(([g, t]) => { setGames((g.games || []).filter((x) => x.is_active)); setExisting(t.tournaments || []); }).catch(() => setErr("Couldn't load games.")); }, []);
  const byCat = useMemo(() => { const m = {}; for (const g of games || []) (m[g.category] = m[g.category] || []).push(g); return m; }, [games]);
  const nameOf = (slug) => (games || []).find((g) => g.slug === slug)?.name || slug;
  const toggle = (s) => setPool((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const plan = useMemo(() => {
    if (!pool.length) return [];
    const [y, m, d] = first.split("-").map(Number); const [hh, mm] = time.split(":").map(Number); const out = [];
    for (let i = 0; i < weeks; i++) {
      const start = new Date(y, m - 1, d + i * 7, hh, mm); const end = new Date(start.getTime() + days * 86400000 - 60000);
      let slugs; if (mode === "same") slugs = pool; else { const n = Math.min(mode === "one" ? 1 : perWeek, pool.length); slugs = Array.from({ length: n }, (_, k) => pool[(i * n + k) % pool.length]); slugs = [...new Set(slugs)]; }
      const fill = (t) => t.replaceAll("{n}", i + 1).replaceAll("{games}", slugs.map(nameOf).join(", ")).replaceAll("{start}", fmt(start)).replaceAll("{end}", fmt(end));
      const e = edits[i] || {};
      out.push({ i, start, end, slugs: e.slugs || slugs, name: e.name ?? fill(nameT), description: rules, announcement: fill(announceT) });
    }
    return out;
  }, [pool, mode, perWeek, weeks, dow, time, days, first, nameT, rules, announceT, edits, games]); // eslint-disable-line react-hooks/exhaustive-deps

  const clash = (p) => existing.filter((t) => new Date(t.starts_at) < p.end && new Date(t.ends_at) > p.start && t.game_slugs.some((s) => p.slugs.includes(s)));
  const active = plan.filter((p) => !skip[p.i]);

  async function create() {
    setBusy(true); setErr(""); setDone("");
    const items = active.map((p) => ({ name: p.name, description: p.description, starts_at: p.start.toISOString(), ends_at: p.end.toISOString(), game_slugs: p.slugs, announcement: p.announcement, require_tournament_entry: exclusive }));
    const r = await fetch("/api/admin/tournaments/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) }); const d = await r.json().catch(() => ({}));
    setBusy(false); if (r.ok) { setDone(`Created ${d.created} tournaments. You can edit any of them from the Tournaments page.`); setPool([]); } else setErr(d.error || "Could not create.");
  }
  const inp = "w-full rounded-lg bg-bgPanel border border-lineColor px-3 py-2 text-sm outline-none focus:border-accentCyan"; const lab = "block font-mono text-[10px] text-textDim mb-1 uppercase tracking-wider";
  if (!games) return <p className="text-textDim text-sm">{err || "Loading…"}</p>;
  return (
    <div className="flex flex-col gap-6">
      <section className="ap-glass rounded-2xl p-4"><h2 className="font-semibold mb-3">1 · Pick the games</h2>
        {Object.entries(byCat).map(([c, list]) => <div key={c} className="mb-3"><p className="font-mono text-[10px] text-textDim mb-1.5">{c}</p><div className="flex flex-wrap gap-2">{list.map((g) => <button type="button" key={g.slug} onClick={() => toggle(g.slug)} aria-pressed={pool.includes(g.slug)} className={"text-xs px-3 py-1.5 rounded-full border " + (pool.includes(g.slug) ? "border-accentCyan bg-accentCyan/15 text-accentCyan" : "border-lineColor text-textDim")}>{g.icon} {g.name}</button>)}</div></div>)}
        <p className="text-[11px] text-textDim">{pool.length} selected</p>
      </section>
      <section className="ap-glass rounded-2xl p-4 grid sm:grid-cols-2 gap-4"><h2 className="font-semibold sm:col-span-2">2 · Which games each week?</h2>
        <div className="sm:col-span-2 flex flex-wrap gap-2">{[["same", "Same games every week"], ["rotate", "Rotate a few games each week"], ["one", "One featured game each week"]].map(([k, l]) => <button type="button" key={k} onClick={() => setMode(k)} className={"text-xs px-3 py-1.5 rounded-full border " + (mode === k ? "border-gold text-gold" : "border-lineColor text-textDim")}>{l}</button>)}</div>
        {mode === "rotate" && <div><label className={lab}>Games per week</label><input type="number" min={1} max={10} value={perWeek} onChange={(e) => setPerWeek(Math.max(1, +e.target.value || 1))} className={inp} /></div>}
      </section>
      <section className="ap-glass rounded-2xl p-4 grid sm:grid-cols-4 gap-4"><h2 className="font-semibold sm:col-span-4">3 · Schedule</h2>
        <div><label className={lab}>First week starts</label><input type="date" value={first} onChange={(e) => setFirst(e.target.value)} className={inp} /></div>
        <div><label className={lab}>Start time</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inp} /></div>
        <div><label className={lab}>Number of weeks</label><input type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Math.min(52, Math.max(1, +e.target.value || 1)))} className={inp} /></div>
        <div><label className={lab}>Each runs for (days)</label><input type="number" min={1} max={14} value={days} onChange={(e) => setDays(Math.min(14, Math.max(1, +e.target.value || 1)))} className={inp} /></div>
        <p className="sm:col-span-4 text-[11px] text-textDim">26 weeks is about 6 months. Times use your computer&apos;s clock. The first week starts on the date you pick ({first ? DAYS[new Date(first + "T00:00").getDay()] : ""}); every following week starts 7 days later.</p>
      </section>
      <section className="ap-glass rounded-2xl p-4 grid gap-4"><h2 className="font-semibold">4 · Rules and wording</h2>
        <div className="flex flex-wrap gap-2">{Object.keys(RULES).map((k) => <button type="button" key={k} onClick={() => { setRuleKey(k); if (k !== "custom") setRules(RULES[k]); }} className={"text-xs px-3 py-1.5 rounded-full border " + (ruleKey === k ? "border-gold text-gold" : "border-lineColor text-textDim")}>{RULE_NAMES[k]}</button>)}</div>
        <div><label className={lab}>Rules shown to players</label><textarea rows={3} maxLength={1000} value={rules} onChange={(e) => { setRules(e.target.value); setRuleKey("custom"); }} className={inp} /></div>
        <div className="grid sm:grid-cols-2 gap-4"><div><label className={lab}>Name (use {"{n}"} for the week number)</label><input value={nameT} onChange={(e) => setNameT(e.target.value)} className={inp} /></div>
          <div><label className={lab}>Announcement ({"{n}"}, {"{games}"}, {"{start}"}, {"{end}"})</label><input value={announceT} onChange={(e) => setAnnounceT(e.target.value)} className={inp} /></div></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={exclusive} onChange={(e) => setExclusive(e.target.checked)} /> Tournament-only: these games can only be played for the tournament while it runs</label>
        <p className="text-[11px] text-textDim">Scoring itself is automatic: score games use each player&apos;s best score in the week, duel games count wins. The rules text is what players read.</p>
      </section>
      <section className="ap-glass rounded-2xl p-4"><h2 className="font-semibold mb-3">5 · Preview ({active.length} of {plan.length} will be created)</h2>
        {!plan.length ? <p className="text-textDim text-sm">Pick at least one game to see the plan.</p> : (
          <div className="flex flex-col gap-2 max-h-[28rem] overflow-y-auto pr-1">{plan.map((p) => { const c = clash(p); return (
            <div key={p.i} className={"rounded-lg border px-3 py-2 " + (skip[p.i] ? "opacity-40 border-lineColor" : "border-lineColor")}>
              <div className="flex items-center gap-2 flex-wrap"><input value={p.name} onChange={(e) => setEdits((x) => ({ ...x, [p.i]: { ...x[p.i], name: e.target.value } }))} className="flex-1 min-w-[180px] bg-transparent text-sm font-semibold outline-none border-b border-transparent focus:border-accentCyan" />
                <label className="text-[11px] text-textDim flex items-center gap-1"><input type="checkbox" checked={!!skip[p.i]} onChange={(e) => setSkip((x) => ({ ...x, [p.i]: e.target.checked }))} /> skip</label></div>
              <p className="text-[11px] text-textDim">{fmt(p.start)} → {fmt(p.end)}</p>
              <p className="text-[11px] mt-1" style={{ color: "var(--ad-blue,#9fd4ff)" }}>{p.slugs.map(nameOf).join(" · ")}</p>
              {c.length > 0 && <p className="text-[11px] text-accentAmber mt-1">⚠ Overlaps an existing tournament with the same game: {c.map((t) => t.name).join(", ")}</p>}
            </div>); })}</div>)}
      </section>
      {err && <p className="text-sm text-accentPink">{err}</p>}{done && <p className="text-sm text-green-300">{done}</p>}
      <button type="button" disabled={busy || !active.length} onClick={create} className="self-start rounded-xl bg-accentCyan text-bgDeep font-semibold px-6 py-3 disabled:opacity-40">{busy ? "Creating…" : `Create ${active.length} tournaments`}</button>
    </div>
  );
}
