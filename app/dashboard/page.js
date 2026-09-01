import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import Navbar from "@/components/Navbar";
import GameCard from "@/components/GameCard";
import LeaderboardTabs from "@/components/LeaderboardTabs";
import ScrollRestore from "@/components/ScrollRestore";
import ArcadeMusic from "@/components/ArcadeMusic";
import { getGames, getCategories } from "@/lib/games";
import { getContinuePlaying, getTrendingGames, getHiddenGems, formatRelativeTime } from "@/lib/discovery";
import { getRecentActivity } from "@/lib/activity";
import ActivityFeed from "@/components/ActivityFeed";
import { currentStreakDays } from "@/lib/achievements";
import { getDailyChallengeStatus } from "@/lib/challenges";
import DailyChallengesPanel from "@/components/DailyChallengesPanel";
import FlagshipBanner from "@/components/FlagshipBanner";

export const metadata = {
  title: "Dashboard",
  alternates: { canonical: "/dashboard" },
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: scores }, games, categories, continuePlaying, trending, recentActivity, streakDays, dailyChallenges] = await Promise.all([
    supabase.from("profiles").select("username, is_admin").eq("id", user.id).single(),
    supabase.from("scores").select("game, score").eq("user_id", user.id),
    getGames(),
    getCategories(),
    getContinuePlaying(user.id, 6),
    getTrendingGames(8),
    getRecentActivity(supabase, 20),
    currentStreakDays(supabase, user.id),
    getDailyChallengeStatus(supabase, user.id),
  ]);

  const bestByGame = {};
  let totalPoints = 0;
  for (const row of scores || []) {
    bestByGame[row.game] = row.score;
    totalPoints += row.score;
  }

  const gamesBySlug = Object.fromEntries(games.map((g) => [g.slug, g]));
  const hiddenGemSlugs = await getHiddenGems(games.map((g) => g.slug), 6);
  const hiddenGems = hiddenGemSlugs.map((slug) => gamesBySlug[slug]).filter(Boolean);

  const continuePlayingGames = continuePlaying
    .map((row) => ({ ...gamesBySlug[row.game], playedAt: row.played_at }))
    .filter((g) => g.slug);
  const trendingGames = trending
    .map((row) => gamesBySlug[row.game])
    .filter(Boolean);
  const trendingSlugs = new Set(trendingGames.map((g) => g.slug));

  // "Because you played X" — the category of the most recently played
  // game, minus games already played. Computed entirely from data
  // already fetched above; no new query.
  const seedGame = continuePlayingGames[0];
  const becauseYouPlayedGames = seedGame
    ? games.filter((g) => g.category === seedGame.category && g.slug !== seedGame.slug && !(g.slug in bestByGame)).slice(0, 6)
    : [];

  const username = profile?.username || user.email;

  function priceFor(game) {
    if (game.accessType === "subscription") return `${game.priceDisplay || "—"}/mo`;
    return game.free ? null : game.priceDisplay;
  }

  // Arcade is the site's main highlight, shown first. Legend Pass is
  // the flagship tier — shown right after, ahead of Power Pass.
  const CATEGORY_ORDER = { Arcade: 0, "Legend Pass": 1, "Power Pass": 2 };
  const orderedCategories = [...categories].sort((a, b) => {
    const rankA = CATEGORY_ORDER[a] ?? 99;
    const rankB = CATEGORY_ORDER[b] ?? 99;
    return rankA - rankB;
  });

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <ScrollRestore />
      <ArcadeMusic />
      <Navbar username={username} points={totalPoints} isAdmin={profile?.is_admin} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8 flex items-end justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-pixel text-sm text-textLight mb-1">{games.length} GAMES</h1>
            <p className="text-textDim text-sm">Pick one and start climbing the leaderboard.</p>
          </div>
          {streakDays > 0 && (
            <div className="font-mono text-xs px-3 py-1.5 rounded-full border border-accentAmber text-accentAmber">
              🔥 {streakDays} day{streakDays === 1 ? "" : "s"} in a row
            </div>
          )}
        </div>

        <DailyChallengesPanel challenges={dailyChallenges} />

        <FlagshipBanner games={games} bestByGame={bestByGame} />

        {continuePlayingGames.length > 0 && (
          <div className="mb-10">
            <h2 className="font-mono text-xs uppercase tracking-widest text-textDim mb-3">Continue Playing</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
              {continuePlayingGames.map((game) => (
                <div key={game.slug} className="w-64 shrink-0">
                  <GameCard
                    href={`/games/${game.slug}`}
                    icon={game.icon}
                    name={game.name}
                    tagline={game.tagline}
                    accentColor={game.accentColor}
                    best={bestByGame[game.slug] || 0}
                    price={priceFor(game)}
                    underMaintenance={game.underMaintenance}
                    desktopOnly={game.category === "Legend Pass"}
                    lastPlayedLabel={formatRelativeTime(game.playedAt)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {trendingGames.length > 0 && (
          <div className="mb-10">
            <h2 className="font-mono text-xs uppercase tracking-widest text-textDim mb-3">Trending This Week</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
              {trendingGames.map((game) => (
                <div key={game.slug} className="w-64 shrink-0">
                  <GameCard
                    href={`/games/${game.slug}`}
                    icon={game.icon}
                    name={game.name}
                    tagline={game.tagline}
                    accentColor={game.accentColor}
                    best={bestByGame[game.slug] || 0}
                    price={priceFor(game)}
                    underMaintenance={game.underMaintenance}
                    desktopOnly={game.category === "Legend Pass"}
                    trending
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {becauseYouPlayedGames.length > 0 && (
          <div className="mb-10">
            <h2 className="font-mono text-xs uppercase tracking-widest text-textDim mb-3">Because You Played {seedGame.name}</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
              {becauseYouPlayedGames.map((game) => (
                <div key={game.slug} className="w-64 shrink-0">
                  <GameCard
                    href={`/games/${game.slug}`}
                    icon={game.icon}
                    name={game.name}
                    tagline={game.tagline}
                    accentColor={game.accentColor}
                    best={bestByGame[game.slug] || 0}
                    price={priceFor(game)}
                    underMaintenance={game.underMaintenance}
                    desktopOnly={game.category === "Legend Pass"}
                    trending={trendingSlugs.has(game.slug)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {hiddenGems.length > 0 && (
          <div className="mb-10">
            <h2 className="font-mono text-xs uppercase tracking-widest text-textDim mb-3">Hidden Gems</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
              {hiddenGems.map((game) => (
                <div key={game.slug} className="w-64 shrink-0">
                  <GameCard
                    href={`/games/${game.slug}`}
                    icon={game.icon}
                    name={game.name}
                    tagline={game.tagline}
                    accentColor={game.accentColor}
                    best={bestByGame[game.slug] || 0}
                    price={priceFor(game)}
                    underMaintenance={game.underMaintenance}
                    desktopOnly={game.category === "Legend Pass"}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {orderedCategories.map((category) => (
          <div key={category} id={category === "Power Pass" ? "power-pass" : category === "Legend Pass" ? "legend-pass" : undefined} className="mb-10 scroll-mt-24">
            <h2 className="font-mono text-xs uppercase tracking-widest text-textDim mb-1">{category}</h2>
            {category === "Power Pass" && (
              <p className="font-mono text-[11px] text-accentCyan mb-3">
                👑 One Pass unlocks every game below — subscribe from any single one of them and you're in for all of them.
              </p>
            )}
            {category === "Legend Pass" && (
              <p className="font-mono text-[11px] text-accentAmber mb-3">
                ⚡ Our flagship tier — a separate Pass from Power Pass, unlocking the deepest games on the site.
                💻 Built for laptop and desktop screens — not optimized for mobile.
              </p>
            )}
            <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {games
                .filter((g) => g.category === category)
                .map((game) => (
                  <GameCard
                    key={game.slug}
                    href={`/games/${game.slug}`}
                    icon={game.icon}
                    name={game.name}
                    tagline={game.tagline}
                    accentColor={game.accentColor}
                    best={bestByGame[game.slug] || 0}
                    price={priceFor(game)}
                    underMaintenance={game.underMaintenance}
                    desktopOnly={game.category === "Legend Pass"}
                    trending={trendingSlugs.has(game.slug)}
                  />
                ))}
            </div>
          </div>
        ))}

        <ActivityFeed events={recentActivity} gamesBySlug={gamesBySlug} />

        <div className="rounded-xl border border-lineColor p-5 sm:p-6 bg-bgPanel">
          <h2 className="font-pixel text-[11px] tracking-wide text-accentCyan mb-4">HIGH SCORES</h2>
          <LeaderboardTabs highlightUsername={username} games={games} />
        </div>
      </div>
    </div>
  );
}
