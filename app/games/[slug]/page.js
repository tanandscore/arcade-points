import { redirect, notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import Navbar from "@/components/Navbar";
import Leaderboard from "@/components/Leaderboard";
import GameRunner from "@/components/games/GameRunner";
import BuyButton from "@/components/games/BuyButton";
import UpgradeNudge from "@/components/UpgradeNudge";
import { getGame, getGames } from "@/lib/games";
import { hasSubscriptionAccess } from "@/lib/access";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, is_admin, is_premium, bonus_subscription_until")
    .eq("id", user.id)
    .single();

  // A game marked admin_test_only is fully live and playable, but
  // deliberately invisible to everyone except admins — the real
  // equivalent of "upload and test before rolling out to the main
  // site" in a compiled Next.js app, where nothing can genuinely be
  // uploaded and run at request time.
  if (game.adminTestOnly && !profile?.is_admin) notFound();

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
    owned = await hasSubscriptionAccess(supabase, user.id, game.subscriptionPlanId, profile);
  }

  // Used only for the "unlocks all N Pass games" messaging below —
  // computed from the live games table so it never goes stale as more
  // Pass games are added.
  let sameTierCount = 0;
  if (!owned && game.accessType === "subscription") {
    const allGames = await getGames();
    sameTierCount = allGames.filter((g) => g.subscriptionPlanId === game.subscriptionPlanId).length;
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
        {game.category === "Legend Pass" && (
          <p className="text-center font-mono text-[10px] text-textDim mb-6">
            💻 Built for laptop and desktop screens — opens in fullscreen, not optimized for mobile.
          </p>
        )}

        {game.underMaintenance ? (
          <div className="rounded-xl border border-accentAmber/40 p-10 text-center bg-bgPanel max-w-md mx-auto">
            <div className="text-4xl mb-4">🔧</div>
            <p className="font-pixel text-xs text-accentAmber mb-3">GAME ENGINE UPDATING</p>
            <p className="text-textDim text-sm">
              {game.name} is getting a quick update behind the scenes. This usually takes just a few minutes —
              check back shortly. Everything else on the site is working normally.
            </p>
          </div>
        ) : owned ? (
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
                <p className="text-textDim mb-1">{game.name} is a {game.subscriptionPlanName || "Power Pass"} game.</p>
                <p className="font-pixel text-xl text-accentAmber mb-2">{game.priceDisplay || "—"}/month</p>
                <p className="text-[12px] text-accentCyan mb-6 max-w-xs mx-auto">
                  👑 One {game.subscriptionPlanName || "Power Pass"} unlocks all {sameTierCount || ""}{" "}
                  games for as long as it's active — not just this one.
                </p>
              </>
            )}
            <BuyButton
              slug={game.slug}
              gameName={game.name}
              accessType={game.accessType}
              priceDisplay={game.priceDisplay}
              planName={game.subscriptionPlanName || "Power Pass"}
            />
          </div>
        )}

        {game.free && !profile?.is_premium && !profile?.is_admin && <UpgradeNudge />}

        <div className="mt-12">
          <h2 className="font-pixel text-[10px] mb-3 text-textDim">🏆 TOP 5 ALL-TIME</h2>
          <div className="rounded-xl border border-lineColor p-4 bg-bgPanel">
            <Leaderboard game={game.slug} highlightUsername={username} limit={5} />
          </div>
        </div>
      </div>
    </div>
  );
}
