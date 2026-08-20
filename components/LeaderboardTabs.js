"use client";

import { useState } from "react";
import Leaderboard from "./Leaderboard";
import { GAMES } from "@/lib/games";

const TABS = [{ key: "overall", label: "Overall" }, ...GAMES.map((g) => ({ key: g.slug, label: g.name }))];

export default function LeaderboardTabs({ highlightUsername }) {
  const [tab, setTab] = useState("overall");

  return (
    <div>
      <div className="flex gap-1.5 flex-wrap mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`font-mono text-[10px] px-2.5 py-1 rounded-md border ${
              tab === t.key ? "bg-accentCyan text-bgDeep border-accentCyan" : "border-lineColor text-textDim"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Leaderboard game={tab} highlightUsername={highlightUsername} />
    </div>
  );
}
