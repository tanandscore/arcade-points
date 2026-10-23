"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import CountryTag from "./CountryTag";
import PremiumBadge from "./PremiumBadge";
import { extraBoardsOf } from "@/lib/boards";

// game = any slug from lib/games.js, or 'overall'. limit defaults to
// 10 (used by the dashboard's leaderboard tabs); the individual game
// page passes 5 explicitly.
const MEDAL = ["🥇", "🥈", "🥉"];

export default function Leaderboard({ game, highlightUsername, limit = 10 }) {
  const [rows, setRows] = useState(null);
  // A game with more than one board (Midnight Burn: Mumbai Drift and Tokyo Drift) shows a small switch; every other game is unchanged.
  const extras = extraBoardsOf(game);
  const [board, setBoard] = useState(game);
  useEffect(() => { setBoard(game); }, [game]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      if (game === "overall") {
        // Sum each user's scores across all games client-side.
        const { data, error } = await supabase
          .from("scores")
          .select("user_id, game, score, profiles(username, country, is_premium)");
        if (error || cancelled) return;
        const totals = {};
        for (const r of data || []) {
          const uname = r.profiles?.username || "player";
          if (!totals[uname]) {
            totals[uname] = {
              username: uname,
              country: r.profiles?.country || null,
              isPremium: r.profiles?.is_premium || false,
              score: 0,
            };
          }
          totals[uname].score += r.score;
        }
        const sorted = Object.values(totals)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
        if (!cancelled) setRows(sorted);
      } else {
        const { data, error } = await supabase
          .from("scores")
          .select("score, profiles(username, country, is_premium)")
          .eq("game", board)
          .order("score", { ascending: false })
          .limit(limit);
        if (error || cancelled) return;
        setRows(
          (data || []).map((r) => ({
            username: r.profiles?.username || "player",
            country: r.profiles?.country || null,
            isPremium: r.profiles?.is_premium || false,
            score: r.score,
          }))
        );
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [game, board, limit]);

  const switcher = extras.length > 0 && (
    <div className="flex gap-1.5 mb-3">
      {[{ key: game, label: extras[0].baseName }, ...extras.map((b) => ({ key: b.key, label: b.name }))].map((t) => (
        <button key={t.key} type="button" onClick={() => { setRows(null); setBoard(t.key); }}
          className={`font-mono text-[10px] px-2.5 py-1 rounded-md border ${board === t.key ? "bg-accentCyan text-bgDeep border-accentCyan" : "border-lineColor text-textDim"}`}>{t.label}</button>
      ))}
    </div>
  );

  if (rows === null) {
    return <div>{switcher}<p className="font-mono text-xs py-6 text-center text-textDim">Loading scores...</p></div>;
  }

  if (rows.length === 0) {
    return <div>{switcher}<p className="font-mono text-xs py-6 text-center text-textDim">No scores yet — be the first on the board.</p></div>;
  }

  return (
    <div className="font-mono text-sm">
      {switcher}
      {rows.map((r, i) => (
        <div
          key={`${r.username}-${i}`}
          className="flex items-center justify-between py-1.5 border-b border-lineColor last:border-0"
          style={{ color: r.username === highlightUsername ? "#ffb703" : "#f5f0ff" }}
        >
          <span className="flex items-center gap-3">
            <span className="w-5">{MEDAL[i] ? <span className="text-base">{MEDAL[i]}</span> : <span className="text-textDim">#{i + 1}</span>}</span>
            <CountryTag code={r.country} />
            {r.isPremium && <PremiumBadge />}
            <span>{r.username}</span>
          </span>
          <span>{r.score.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
