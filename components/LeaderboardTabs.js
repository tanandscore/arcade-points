"use client";

import { useState } from "react";
import Leaderboard from "./Leaderboard";

export default function LeaderboardTabs({ highlightUsername, games }) {
  const [tab, setTab] = useState("overall");
  const tabs = [{ slug: "overall", name: "Overall" }, ...games];

  return (
    <div>
      <div className="flex gap-1.5 flex-wrap mb-4">
        {tabs.map((t) => (
          <button
            key={t.slug}
            onClick={() => setTab(t.slug)}
            className={`font-mono text-[10px] px-2.5 py-1 rounded-md border ${
              tab === t.slug ? "bg-accentCyan text-bgDeep border-accentCyan" : "border-lineColor text-textDim"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <Leaderboard game={tab} highlightUsername={highlightUsername} />
    </div>
  );
}
