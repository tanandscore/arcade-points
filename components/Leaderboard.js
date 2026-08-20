"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import CountryTag from "./CountryTag";

// game = any slug from lib/games.js, or 'overall'
export default function Leaderboard({ game, highlightUsername }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      if (game === "overall") {
        // Sum each user's scores across all games client-side.
        const { data, error } = await supabase
          .from("scores")
          .select("user_id, game, score, profiles(username, country)");
        if (error || cancelled) return;
        const totals = {};
        for (const r of data || []) {
          const uname = r.profiles?.username || "player";
          if (!totals[uname]) totals[uname] = { username: uname, country: r.profiles?.country || null, score: 0 };
          totals[uname].score += r.score;
        }
        const sorted = Object.values(totals)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);
        if (!cancelled) setRows(sorted);
      } else {
        const { data, error } = await supabase
          .from("scores")
          .select("score, profiles(username, country)")
          .eq("game", game)
          .order("score", { ascending: false })
          .limit(10);
        if (error || cancelled) return;
        setRows(
          (data || []).map((r) => ({
            username: r.profiles?.username || "player",
            country: r.profiles?.country || null,
            score: r.score,
          }))
        );
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [game]);

  if (rows === null) {
    return <p className="font-mono text-xs py-6 text-center text-textDim">Loading scores...</p>;
  }

  if (rows.length === 0) {
    return <p className="font-mono text-xs py-6 text-center text-textDim">No scores yet — be the first on the board.</p>;
  }

  return (
    <div className="font-mono text-sm">
      {rows.map((r, i) => (
        <div
          key={`${r.username}-${i}`}
          className="flex items-center justify-between py-1.5 border-b border-lineColor last:border-0"
          style={{ color: r.username === highlightUsername ? "#ffb703" : "#f5f0ff" }}
        >
          <span className="flex items-center gap-3">
            <span className="text-textDim">#{i + 1}</span>
            <CountryTag code={r.country} />
            <span>{r.username}</span>
          </span>
          <span>{r.score.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
