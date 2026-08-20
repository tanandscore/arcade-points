import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import Navbar from "@/components/Navbar";
import GameCard from "@/components/GameCard";
import LeaderboardTabs from "@/components/LeaderboardTabs";

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const { data: scores } = await supabase
    .from("scores")
    .select("game, score")
    .eq("user_id", user.id);

  const bestByGame = { reflex: 0, memory: 0, math: 0 };
  let totalPoints = 0;
  for (const row of scores || []) {
    bestByGame[row.game] = row.score;
    totalPoints += row.score;
  }

  const username = profile?.username || user.email;

  return (
    <div>
      <Navbar username={username} points={totalPoints} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <GameCard
            href="/games/reflex"
            icon="⚡"
            name="Reflex Tap"
            tagline="Tap the instant it turns green."
            accentColor="#3ee6e0"
            best={bestByGame.reflex}
          />
          <GameCard
            href="/games/memory"
            icon="🧠"
            name="Memory Match"
            tagline="Clear the board in the fewest moves."
            accentColor="#ff3ea5"
            best={bestByGame.memory}
          />
          <GameCard
            href="/games/math"
            icon="🔢"
            name="Math Rush"
            tagline="Solve as many as you can in 30s."
            accentColor="#ffb703"
            best={bestByGame.math}
            price="₹149"
          />
        </div>

        <div className="rounded-xl border border-lineColor p-5 sm:p-6 bg-bgPanel">
          <h2 className="font-pixel text-[11px] tracking-wide text-accentCyan mb-4">HIGH SCORES</h2>
          <LeaderboardTabs highlightUsername={username} />
        </div>
      </div>
    </div>
  );
}
