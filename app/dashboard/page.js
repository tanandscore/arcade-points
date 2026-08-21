import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabaseServer";
import Navbar from "@/components/Navbar";
import GameCard from "@/components/GameCard";
import LeaderboardTabs from "@/components/LeaderboardTabs";
import ScrollRestore from "@/components/ScrollRestore";
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

  // Arcade is the site's main highlight — shown first, everything
  // else keeps its normal order after it.
  const orderedCategories = [...categories].sort((a, b) => {
    if (a === "Arcade") return -1;
    if (b === "Arcade") return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <ScrollRestore />
      <Navbar username={username} points={totalPoints} isAdmin={profile?.is_admin} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-pixel text-sm text-textLight mb-1">{games.length} GAMES</h1>
          <p className="text-textDim text-sm">Pick one and start climbing the leaderboard.</p>
        </div>

        {popularGames.length > 0 && (
          <div className="mb-10">
            <h2 className="font-mono text-xs uppercase tracking-widest text-textDim mb-3 flex items-center gap-2">
              🔥 Most Played
            </h2>
            <div className="rounded-xl border border-lineColor bg-bgPanel overflow-hidden">
              {popularGames.map((game, i) => (
                <Link
                  key={game.slug}
                  href={`/games/${game.slug}`}
                  className="flex items-center justify-between px-4 py-3 border-b border-lineColor last:border-0 hover:bg-bgPanel3 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center font-pixel text-[9px] text-bgDeep shrink-0"
                      style={{ background: RANK_COLORS[i] || "#a99fd6" }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-lg">{game.icon}</span>
                    <span className="text-sm text-textLight">{game.name}</span>
                  </span>
                  <span className="font-mono text-[11px] text-textDim">
                    {game.playerCount} player{game.playerCount === 1 ? "" : "s"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {orderedCategories.map((category) => (
          <div key={category} id={category === "Premium" ? "premium" : undefined} className="mb-10 scroll-mt-24">
            <h2 className="font-mono text-xs uppercase tracking-widest text-textDim mb-1">{category}</h2>
            {category === "Premium" && (
              <p className="font-mono text-[11px] text-accentCyan mb-3">
                👑 One subscription unlocks every game below — subscribe from any single one of them and you're in for all of them.
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
