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
    return <p className="st-muted text-[14px] text-center py-6">Loading achievements...</p>;
  }

  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;

  return (
    <section aria-labelledby="ach-h">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <h2 id="ach-h" className="st-h2">Achievements</h2>
        <p className="st-muted text-[13.5px]">{unlockedCount} of {achievements.length} unlocked</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {achievements.map((a) => {
          const unlocked = !!a.unlockedAt;
          const tierColor = TIER_COLORS[a.tier] || "#a99fd6";
          return (
            <div
              key={a.id}
              className="rounded-2xl p-4 flex gap-3.5 items-start"
              style={{
                boxShadow: `inset 0 0 0 1px ${unlocked ? `${tierColor}99` : "rgba(169,159,214,0.22)"}`,
                background: unlocked ? "rgba(255,255,255,0.045)" : "transparent",
                opacity: unlocked ? 1 : 0.6,
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: unlocked ? `${tierColor}22` : "rgba(169,159,214,0.1)" }}
              >
                {unlocked ? a.icon : "🔒"}
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-textLight leading-snug">{a.name}</p>
                <p className="st-muted text-[13px] mt-0.5 leading-snug">{a.description}</p>
                <div className="flex items-center gap-x-2.5 gap-y-1 mt-2 flex-wrap text-[12px] text-[#a99fd6]">
                  <span className="capitalize font-semibold px-2 py-0.5 rounded-full" style={{ color: tierColor, boxShadow: `inset 0 0 0 1px ${tierColor}66` }}>
                    {a.tier}
                  </span>
                  <span>+{a.xp_value} XP</span>
                  <span>{a.globalCompletionPct}% of players</span>
                </div>
                {unlocked && (
                  <p className="text-[12px] text-accentCyan mt-1.5">
                    Unlocked {new Date(a.unlockedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
