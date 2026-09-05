"use client";

import { useEffect, useState } from "react";

const TIER_COLORS = {
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
  legendary: "#ff3ea5",
};

export default function AchievementsPanel({ username }) {
  const [achievements, setAchievements] = useState(null);

  useEffect(() => {
    const url = username ? `/api/achievements?username=${encodeURIComponent(username)}` : "/api/achievements";
    fetch(url)
      .then((r) => r.json())
      .then((d) => setAchievements(d.achievements || []))
      .catch(() => setAchievements([]));
  }, [username]);

  if (achievements === null) {
    return <p className="font-mono text-xs text-textDim text-center py-6">Loading achievements...</p>;
  }

  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-pixel text-[11px] tracking-wide text-accentCyan">ACHIEVEMENTS</h2>
        <p className="font-mono text-[11px] text-textDim">{unlockedCount}/{achievements.length} unlocked</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {achievements.map((a) => {
          const unlocked = !!a.unlockedAt;
          const tierColor = TIER_COLORS[a.tier] || "#a99fd6";
          return (
            <div
              key={a.id}
              className="rounded-lg border p-4 flex gap-3 items-start"
              style={{
                borderColor: unlocked ? tierColor : "rgba(169,159,214,0.25)",
                background: unlocked ? "rgba(255,255,255,0.03)" : "transparent",
                opacity: unlocked ? 1 : 0.55,
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                style={{ background: unlocked ? `${tierColor}22` : "rgba(169,159,214,0.08)" }}
              >
                {unlocked ? a.icon : "🔒"}
              </div>
              <div className="min-w-0">
                <p className="font-mono text-xs text-textLight">{a.name}</p>
                <p className="font-mono text-[10px] text-textDim mt-0.5">{a.description}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded" style={{ color: tierColor, border: `1px solid ${tierColor}55` }}>
                    {a.tier}
                  </span>
                  <span className="font-mono text-[9px] text-textDim">+{a.xp_value} XP</span>
                  <span className="font-mono text-[9px] text-textDim">{a.globalCompletionPct}% of players</span>
                </div>
                {unlocked && (
                  <p className="font-mono text-[9px] text-accentCyan mt-1">
                    Unlocked {new Date(a.unlockedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
