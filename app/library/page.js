import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import GameCard from "@/components/store/GameCard";
import Shelf from "@/components/store/Shelf";
import FavShelf from "@/components/store/FavShelf";
import { getGames, getComingSoon } from "@/lib/games";
import { getContinuePlaying, formatRelativeTime } from "@/lib/discovery";
import { getSaveSummaries } from "@/lib/progress";
import { getViewer } from "@/lib/viewer";
import { tierCovers } from "@/lib/catalog";

export const metadata = {
  title: "Your library",
  alternates: { canonical: "/library" },
  robots: { index: false, follow: false },
};

// Everything the player can open right now, with where they are in each game. Games that need a pass they do not have sit at
// the bottom, so "what could I unlock" is one scroll away but never in the way.
export default async function LibraryPage() {
  const v = await getViewer();
  if (!v.user) redirect("/login?next=/library");
  const { supabase, user } = v;

  const [games, soon, played, summaries] = await Promise.all([
    getGames(),
    getComingSoon(),
    getContinuePlaying(user.id, 40),
    getSaveSummaries(supabase, user.id),
  ]);

  const mine = (g) => v.isAdmin || tierCovers(v.tier || "free", g.tier);
  const lastPlayed = {};
  for (const r of played) if (!lastPlayed[r.game]) lastPlayed[r.game] = r.played_at;

  const playable = games.filter(mine).sort((a, b) => (lastPlayed[b.slug] || "").localeCompare(lastPlayed[a.slug] || "") || a.order - b.order);
  const locked = games.filter((g) => !mine(g));
  const startedCount = games.filter((g) => lastPlayed[g.slug] || v.bestByGame[g.slug]).length;
  const clearedTotal = Object.values(summaries).reduce((n, s) => n + s.done, 0);
  const starsTotal = Object.values(summaries).reduce((n, s) => n + s.stars, 0);

  const noteFor = (g) => {
    const s = summaries[g.slug];
    const when = lastPlayed[g.slug] ? formatRelativeTime(lastPlayed[g.slug]) : null;
    if (g.kit && g.levels && s) return `${Math.min(s.done, g.levels)} of ${g.levels} levels${when ? `, ${when}` : ""}`;
    const best = v.bestByGame[g.slug];
    if (best) return `Best ${best.toLocaleString()}${when ? `, ${when}` : ""}`;
    return when ? `Played ${when}` : null;
  };
  const progressFor = (g) => (g.kit && g.levels && summaries[g.slug] ? Math.min(1, summaries[g.slug].done / g.levels) : null);

  const stats = [
    [v.points.toLocaleString(), "points"],
    [`${startedCount} of ${games.length}`, "games played"],
    [clearedTotal, "levels cleared"],
    [starsTotal, "stars"],
  ];
  const lite = [...games, ...soon].map((g) => ({ slug: g.slug, name: g.name, icon: g.icon, genre: g.genre, style: g.style, tier: g.tier, tierName: g.tierName, status: g.status, isNew: g.isNew, accentColor: g.accentColor, tagline: g.tagline, capsule: g.capsule, free: g.free, underMaintenance: g.underMaintenance }));

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <Navbar username={v.username} points={v.points} isAdmin={v.isAdmin} />
      <main className="st-container pt-7 pb-16">
        <h1 className="st-h1" style={{ fontSize: "clamp(1.9rem, 4vw, 2.8rem)" }}>Your library</h1>
        <p className="st-muted mt-2 text-[15.5px]">{playable.length} {playable.length === 1 ? "game" : "games"} ready to play{v.isAdmin ? " (admin: everything is unlocked)" : ""}.</p>

        <ul className="st-band mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 px-5 py-5" aria-label="Your numbers">
          {stats.map(([n, l]) => (
            <li key={l}>
              <p className="st-num text-[1.6rem] leading-none text-accentCyan">{n}</p>
              <p className="st-muted text-[13px] mt-2">{l}</p>
            </li>
          ))}
        </ul>

        <div className="mt-12 space-y-12">
          <Shelf id="games" title="Your games" cols={4}>
            {playable.map((g) => <GameCard key={g.slug} game={g} showTier={g.tier !== "free"} progress={progressFor(g)} note={noteFor(g)} href={`/games/${g.slug}?play=1`} />)}
          </Shelf>

          <FavShelf games={lite} />

          {locked.length > 0 && (
            <Shelf id="locked" title="Unlock more" note="These need a pass. One pass opens every game in its tier." href="/pricing" hrefLabel="Compare passes" cols={4}>
              {locked.map((g) => <GameCard key={g.slug} game={g} />)}
            </Shelf>
          )}
        </div>

        {playable.length === 0 && (
          <p className="st-muted mt-8">Nothing here yet. <Link href="/games" className="st-link">Browse the store</Link> to find your first game.</p>
        )}
      </main>
    </div>
  );
}
