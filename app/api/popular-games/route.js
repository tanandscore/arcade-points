import { NextResponse } from "next/server";
import { getPopularGames } from "@/lib/games";

// Feeds the live "Most Played Games" list on the leaderboard. Returns
// only game names and counts (nothing about individual players), and is
// never cached, so each request reflects the latest plays.
export const dynamic = "force-dynamic";

export async function GET() {
  const games = await getPopularGames(10);
  return NextResponse.json(
    { games: games.map((g) => ({ slug: g.slug, name: g.name, icon: g.icon, plays: g.plays, players: g.playerCount })) },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
