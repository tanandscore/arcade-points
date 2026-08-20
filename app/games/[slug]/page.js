import { redirect, notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import Navbar from "@/components/Navbar";
import Leaderboard from "@/components/Leaderboard";
import GameRunner from "@/components/games/GameRunner";
import BuyButton from "@/components/games/BuyButton";
import { getGame } from "@/lib/games";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const game = await getGame(slug);
  if (!game) return {};
  return {
    title: `${game.name} — Play Free Online`,
    description: `${game.tagline} Play ${game.name} free on Tap & Score and climb the leaderboard.`,
    alternates: { canonical: `/games/${game.slug}` },
    robots: { index: false, follow: false },
  };
}

export default async function GamePage({ params }) {
  const { slug } = await params;
  const game = await getGame(slug);
  if (!game) notFound();

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("username, is_admin").eq("id", user.id).single();
  const { data: scores } = await supabase.from("scores").select("game, score").eq("user_id", user.id);
  const totalPoints = (scores || []).reduce((sum, r) => sum + r.score, 0);
  const username = profile?.username || user.email;

  // Admins play everything free — checked before any purchase/subscription
  // lookup, so it's a clean bypass rather than a patch on top of the gate.
  let owned = game.accessType === "free" || profile?.is_admin === true;
  if (!owned && game.accessType === "onetime") {
    const { data: purchase } = await supabase
      .from("purchases")
      .select("game")
      .eq("user_id", user.id)
      .eq("game", slug)
      .maybeSingle();
    owned = !!purchase;
  } else if (!owned && game.accessType === "subscription") {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, plan_id")
      .eq("user_id", user.id)
      .maybeSingle();
    owned = sub?.status === "active" && sub?.plan_id === game.subscriptionPlanId;
  }

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={username} points={totalPoints} isAdmin={profile?.is_admin} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-pixel text-xs mb-2 text-center" style={{ color: game.accentColor }}>
          {game.name.toUpperCase()}
        </h1>
        <div className="text-center mb-6 h-4">
          {profile?.is_admin && !game.free && (
            <p className="font-mono text-[10px] text-accentAmber">★ Admin access — unlocked free</p>
          )}
        </div>

        {owned ? (
          <GameRunner slug={game.slug} name={game.name} accentColor={game.accentColor} />
        ) : (
          <div className="rounded-xl border border-lineColor p-8 text-center bg-bgPanel">
            <div className="text-3xl mb-3">{game.icon}</div>
            {game.accessType === "onetime" ? (
              <>
                <p className="text-textDim mb-1">{game.name} is a paid game.</p>
                <p className="font-pixel text-xl text-accentAmber mb-6">{game.priceDisplay}</p>
              </>
            ) : (
              <>
                <p className="text-textDim mb-1">{game.name} is a {game.subscriptionPlanName || "Premium"} game.</p>
                <p className="font-pixel text-xl text-accentAmber mb-2">{game.priceDisplay || "—"}/month</p>
                <p className="text-[11px] text-textDim mb-6">
                  Unlocks every {game.subscriptionPlanName || "Premium"} game, not just this one.
                </p>
              </>
            )}
            <BuyButton
              slug={game.slug}
              gameName={game.name}
              accessType={game.accessType}
              priceDisplay={game.priceDisplay}
            />
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
