"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// The "Most Played Games" list on the leaderboard. It starts with the
// list the page was built with, then quietly re-checks every 30 seconds
// (only while the tab is visible) so the ranking moves on its own —
// nobody has to reload the page.
export default function MostPlayedLive({ initial }) {
  const [games, setGames] = useState(initial);

  useEffect(() => {
    let stop = false;
    async function refresh() {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/popular-games", { cache: "no-store" });
        if (!res.ok) return;
        const body = await res.json();
        if (!stop && Array.isArray(body.games) && body.games.length > 0) setGames(body.games);
      } catch {
        // offline or a blip — keep showing the last list
      }
    }
    const timer = setInterval(refresh, 30000);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!games || games.length === 0) return null;
  return (
    <div className="mt-12 pt-8 border-t border-lineColor">
      <h2 className="font-mono text-xs uppercase tracking-widest text-textDim mb-3">
        🔥 Most Played Games <span className="normal-case tracking-normal text-[10px] text-accentCyan ml-2">● live</span>
      </h2>
      <div className="rounded-xl border border-lineColor bg-bgPanel overflow-hidden">
        {games.map((game, i) => (
          <Link
            key={game.slug}
            href={`/games/${game.slug}`}
            className="flex items-center gap-3 px-4 py-2.5 border-b border-lineColor last:border-0 hover:bg-bgPanel3 transition-colors font-mono text-sm"
          >
            <span className="text-textDim w-8">#{i + 1}</span>
            <span className="text-lg">{game.icon}</span>
            <span className="text-textLight flex-1">{game.name}</span>
            {game.plays > 0 && <span className="text-textDim text-xs">{Number(game.plays).toLocaleString()} plays</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
