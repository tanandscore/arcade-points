import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import Navbar from "@/components/Navbar";
import GameCard from "@/components/GameCard";
import LeaderboardTabs from "@/components/LeaderboardTabs";
import ScrollRestore from "@/components/ScrollRestore";
import ArcadeMusic from "@/components/ArcadeMusic";
import { getGames, getCategories } from "@/lib/games";

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

  const [{ data: profile }, { data: scores }, games, categories] = await Promise.all([
    supabase.from("profiles").select("username, is_admin").eq("id", user.id).single(),
    supabase.from("scores").select("game, score").eq("user_id", user.id),
    getGames(),
    getCategories(),
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

  // Arcade is the site's main highlight, shown first. Premium Plus is
  // the flagship tier — shown right after, ahead of regular Premium.
  const CATEGORY_ORDER = { Arcade: 0, "Premium Plus": 1, Premium: 2 };
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
        <div className="mb-8">
          <h1 className="font-pixel text-sm text-textLight mb-1">{games.length} GAMES</h1>
          <p className="text-textDim text-sm">Pick one and start climbing the leaderboard.</p>
        </div>

        {orderedCategories.map((category) => (
          <div key={category} id={category === "Premium" ? "premium" : category === "Premium Plus" ? "premium-plus" : undefined} className="mb-10 scroll-mt-24">
            <h2 className="font-mono text-xs uppercase tracking-widest text-textDim mb-1">{category}</h2>
            {category === "Premium" && (
              <p className="font-mono text-[11px] text-accentCyan mb-3">
                👑 One subscription unlocks every game below — subscribe from any single one of them and you're in for all of them.
              </p>
            )}
            {category === "Premium Plus" && (
              <p className="font-mono text-[11px] text-accentAmber mb-3">
                ⚡ Our flagship tier — a separate subscription from Premium, unlocking the deepest games on the site.
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
