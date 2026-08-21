import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import Navbar from "@/components/Navbar";
import GameCard from "@/components/GameCard";
import LeaderboardTabs from "@/components/LeaderboardTabs";
import { getGames, getCategories, getPopularGames } from "@/lib/games";

export const metadata = {
  title: "Dashboard",
  alternates: { canonical: "/dashboard" },
  robots: { index: false, follow: false },
};

const RANK_COLORS = ["#ffb703", "#a99fd6", "#cd7f32", "#3ee6e0", "#ff3ea5"];

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: scores }, games, categories, popularGames] = await Promise.all([
    supabase.from("profiles").select("username, is_admin").eq("id", user.id).single(),
    supabase.from("scores").select("game, score").eq("user_id", user.id),
    getGames(),
    getCategories(),
    getPopularGames(5),
  ]);

  const bestByGame = {};
  let totalPoints = 0;
  for (const row of scores || []) {
    bestByGame[row.game] = row.score;
    totalPoints += row.score;
  }

  const username = profile?.username || user.email;

  function priceFor(game) {
    if (game.accessType === "subscription") return `${game.priceDisplay || "—"}/mo`;
    return game.free ? null : game.priceDisplay;
  }

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={username} points={totalPoints} isAdmin={profile?.is_admin} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-pixel text-sm text-textLight mb-1">{games.length} GAMES</h1>
          <p className="text-textDim text-sm">Pick one and start climbing the leaderboard.</p>
        </div>

        {popularGames.length > 0 && (
          <div className="mb-10">
            <h2 className="font-mono text-xs uppercase tracking-widest text-textDim mb-3 flex items-center gap-2">
              🔥 Most Popular
            </h2>
            <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {popularGames.map((game, i) => (
                <div key={game.slug} className="relative">
                  <span
                    className="absolute -top-2 -left-2 z-10 w-6 h-6 rounded-full flex items-center justify-center font-pixel text-[9px] text-bgDeep"
                    style={{ background: RANK_COLORS[i] }}
                  >
                    {i + 1}
                  </span>
                  <GameCard
                    href={`/games/${game.slug}`}
                    icon={game.icon}
                    name={game.name}
                    tagline={`${game.playerCount} player${game.playerCount === 1 ? "" : "s"} have played this`}
                    accentColor={game.accentColor}
                    best={bestByGame[game.slug] || 0}
                    price={priceFor(game)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {categories.map((category) => (
          <div key={category} id={category === "Premium" ? "premium" : undefined} className="mb-10 scroll-mt-24">
            <h2 className="font-mono text-xs uppercase tracking-widest text-textDim mb-3">{category}</h2>
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
                  />
                ))}
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-lineColor p-5 sm:p-6 bg-bgPanel">
          <h2 className="font-pixel text-[11px] tracking-wide text-accentCyan mb-4">HIGH SCORES</h2>
          <LeaderboardTabs highlightUsername={username} games={games} />
        </div>
      </div>
    </div>
  );
}
