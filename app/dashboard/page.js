import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import Navbar from "@/components/Navbar";
import GameCard from "@/components/GameCard";
import LeaderboardTabs from "@/components/LeaderboardTabs";
import { GAMES, CATEGORIES } from "@/lib/games";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  const { data: scores } = await supabase.from("scores").select("game, score").eq("user_id", user.id);

  const bestByGame = {};
  let totalPoints = 0;
  for (const row of scores || []) {
    bestByGame[row.game] = row.score;
    totalPoints += row.score;
  }

  const username = profile?.username || user.email;

  return (
    <div>
      <Navbar username={username} points={totalPoints} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-pixel text-sm text-textLight mb-1">{GAMES.length} GAMES</h1>
          <p className="text-textDim text-sm">Pick one and start climbing the leaderboard.</p>
        </div>

        {CATEGORIES.map((category) => (
          <div key={category} className="mb-10">
            <h2 className="font-mono text-xs uppercase tracking-widest text-textDim mb-3">{category}</h2>
            <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {GAMES.filter((g) => g.category === category).map((game) => (
                <GameCard
                  key={game.slug}
                  href={`/games/${game.slug}`}
                  icon={game.icon}
                  name={game.name}
                  tagline={game.tagline}
                  accentColor={game.accentColor}
                  best={bestByGame[game.slug] || 0}
                  price={game.free ? null : game.priceDisplay}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-lineColor p-5 sm:p-6 bg-bgPanel">
          <h2 className="font-pixel text-[11px] tracking-wide text-accentCyan mb-4">HIGH SCORES</h2>
          <LeaderboardTabs highlightUsername={username} />
        </div>
      </div>
    </div>
  );
}
