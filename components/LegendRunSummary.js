// Extra block on the result screen for Legend Pass games: rank points earned, rank-ups and the daily mission.
export default function LegendRunSummary({ s, accentColor }) {
  if (!s) return null;
  return (
    <div className="mb-5 rounded-lg border p-3 text-left" style={{ borderColor: `${accentColor}66`, background: "rgba(255,255,255,0.04)" }}>
      <p className="font-mono text-[11px] text-textLight">⭐ +{s.gain} rank points · {s.rank.cur.icon} {s.rank.cur.name}{s.rank.next ? ` (${s.rank.toNext} to ${s.rank.next.name})` : ""}</p>
      {s.rankUp && <p className="font-mono text-[11px] mt-1" style={{ color: accentColor }}>🎉 Rank up! You are now {s.rankUp.icon} {s.rankUp.name}</p>}
      {s.missionJustDone && <p className="font-mono text-[11px] mt-1 text-accentCyan">✅ Daily mission complete: {s.mission.title} (+{s.mission.reward})</p>}
    </div>
  );
}
