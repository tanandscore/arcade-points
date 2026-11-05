"use client";
import { useEffect, useState } from "react";
import { CHALLENGES, CHALLENGE_SLUGS, loadProgress, syncDown, rankFor, missionFor, todayKey } from "@/lib/legend";
import { LEGEND_INFO } from "@/lib/legendInfo";

// Shown once, before a Legend Pass game starts: what to do, three tips, your rank, today's mission and (for the survivor
// games) a Standard / Veteran / Nightmare challenge level.
export default function LegendBriefing({ slug, name, icon, tagline, accentColor, onStart }) {
  const info = LEGEND_INFO[slug];
  const hasChallenge = CHALLENGE_SLUGS.includes(slug);
  const [p, setP] = useState(() => loadProgress(slug));
  const [level, setLevel] = useState(() => { try { return localStorage.getItem(`ts-legend-level-${slug}`) || "standard"; } catch { return "standard"; } });
  useEffect(() => { let on = true; syncDown(slug).then((m) => on && setP(m)); return () => { on = false; }; }, [slug]);
  const rank = rankFor(p.points);
  const mission = missionFor(slug, p.best);
  const doneToday = p.missionDay === todayKey() && p.missionDone;
  const go = () => { try { localStorage.setItem(`ts-legend-level-${slug}`, level); } catch {} onStart(hasChallenge ? level : "standard"); };

  return (
    <div className="ap-pop-in max-w-2xl mx-auto rounded-2xl p-5 sm:p-6" style={{ background: `radial-gradient(120% 90% at 50% -10%, ${accentColor}22, transparent 60%), #150b33`, border: `1px solid ${accentColor}55`, boxShadow: `0 0 40px -14px ${accentColor}` }}>
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{ background: `${accentColor}22`, border: `1px solid ${accentColor}66` }}>{icon}</div>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wide text-textDim">Legend Pass</p>
          <h2 className="font-display font-bold text-2xl leading-tight">{name}</h2>
          {tagline && <p className="text-textDim text-xs mt-0.5">{tagline}</p>}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-textDim mb-1">Your rank</p>
          <p className="text-lg font-bold">{rank.cur.icon} {rank.cur.name}</p>
          <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden"><div className="h-full" style={{ width: `${Math.round(rank.progress * 100)}%`, background: accentColor }} /></div>
          <p className="font-mono text-[10px] text-textDim mt-1.5">{rank.next ? `${rank.toNext} points to ${rank.next.name}` : "Top rank reached"}</p>
          <p className="font-mono text-[10px] text-textDim mt-1">{p.runs} runs · best {p.best.toLocaleString()}{p.streak > 1 ? ` · 🔥 ${p.streak}-day streak` : ""}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-textDim mb-1">Today's mission</p>
          <p className="text-sm font-semibold">{doneToday ? "✅ " : "🎯 "}{mission.title}</p>
          <p className="font-mono text-[10px] text-textDim mt-1.5">{doneToday ? "Done. Come back tomorrow for a new one." : `Reward: +${mission.reward} rank points`}</p>
        </div>
      </div>

      {info && (
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 mb-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-textDim mb-1">How to play</p>
          <p className="text-sm mb-1"><span className="text-textDim">Controls:</span> {info.controls}</p>
          <p className="text-sm mb-2"><span className="text-textDim">Goal:</span> {info.goal}</p>
          <ul className="space-y-1">{info.tips.map((t) => <li key={t} className="text-xs text-textDim">💡 {t}</li>)}</ul>
        </div>
      )}

      {hasChallenge && (
        <div className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-textDim mb-2">Challenge level</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(CHALLENGES).map((c) => (
              <button key={c.id} type="button" onClick={() => setLevel(c.id)} className="rounded-xl p-2.5 text-left border transition-colors" style={{ borderColor: level === c.id ? c.color : "rgba(255,255,255,0.12)", background: level === c.id ? `${c.color}18` : "transparent" }}>
                <p className="text-sm font-bold" style={{ color: c.color }}>{c.name}</p>
                <p className="text-[10px] text-textDim leading-snug mt-0.5">{c.blurb}</p>
                {p.challengeBest?.[c.id] > 0 && <p className="font-mono text-[10px] text-textLight mt-1">Best {p.challengeBest[c.id].toLocaleString()}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      <button type="button" onClick={go} className="w-full font-pixel text-[11px] py-3.5 rounded-xl text-bgDeep hover:scale-[1.01] transition-transform" style={{ background: accentColor, boxShadow: `0 8px 30px -8px ${accentColor}` }}>▶ START</button>
    </div>
  );
}
