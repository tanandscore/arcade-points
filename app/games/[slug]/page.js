import { redirect, notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import Navbar from "@/components/Navbar";
import Leaderboard from "@/components/Leaderboard";
import GameRunner from "@/components/games/GameRunner";
import BuyButton from "@/components/games/BuyButton";
import { getGame } from "@/lib/games";

export default async function GamePage({ params }) {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) notFound();

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  const { data: scores } = await supabase.from("scores").select("game, score").eq("user_id", user.id);
  const totalPoints = (scores || []).reduce((sum, r) => sum + r.score, 0);
  const username = profile?.username || user.email;

  let owned = game.free;
  if (!game.free) {
    const { data: purchase } = await supabase
      .from("purchases")
      .select("game")
      .eq("user_id", user.id)
      .eq("game", slug)
      .maybeSingle();
    owned = !!purchase;
  }

  return (
    <div>
      <Navbar username={username} points={totalPoints} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-pixel text-xs mb-8 text-center" style={{ color: game.accentColor }}>
          {game.name.toUpperCase()}
        </h1>

        {owned ? (
          <GameRunner slug={game.slug} name={game.name} accentColor={game.accentColor} />
        ) : (
          <div className="rounded-xl border border-lineColor p-8 text-center bg-bgPanel">
            <div className="text-3xl mb-3">{game.icon}</div>
            <p className="text-textDim mb-1">{game.name} is a paid game.</p>
            <p className="font-pixel text-xl text-accentAmber mb-6">{game.priceDisplay}</p>
            <BuyButton slug={game.slug} gameName={game.name} priceDisplay={game.priceDisplay} />
          </div>
        )}

        <div className="mt-12">
          <h2 className="font-pixel text-[10px] mb-3 text-textDim">TOP 10</h2>
          <div className="rounded-xl border border-lineColor p-4 bg-bgPanel">
            <Leaderboard game={game.slug} highlightUsername={username} />
          </div>
        </div>
      </div>
    </div>
  );
}
