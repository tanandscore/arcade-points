"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RankMark from "@/components/store/RankMark";

// The "Most played" list on the leaderboard. It starts with the
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
    <section className="mt-12" aria-label="Most played">
      <h2 className="st-h2 mb-3 flex items-center gap-3">
        Most played
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accentCyan" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0 }}>
          <i className="h-2 w-2 animate-pulse rounded-full bg-accentCyan" /> Live
        </span>
      </h2>
      <ol className="st-panel divide-y divide-white/10 overflow-hidden">
        {games.map((game, i) => (
          <li key={game.slug}>
            <Link href={`/games/${game.slug}`} className="flex items-center gap-3 px-4 py-3 text-[15px] transition-colors hover:bg-white/5">
              <RankMark rank={i + 1} />
              <span className="text-xl leading-none">{game.icon}</span>
              <span className="flex-1 truncate font-semibold text-[#f5f0ff]">{game.name}</span>
              {game.plays > 0 && <span className="text-[13.5px] tabular-nums text-[#c3bbea]">{Number(game.plays).toLocaleString()} plays</span>}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
