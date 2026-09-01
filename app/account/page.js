import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import { getGames } from "@/lib/games";
import AccountForm from "./AccountForm";
import ReferralBox from "./ReferralBox";
import SubscriptionBox from "./SubscriptionBox";
import SubscribeButton from "./SubscribeButton";
import DayPassButton from "./DayPassButton";
import PurchaseHistory from "./PurchaseHistory";
import Navbar from "@/components/Navbar";
import AchievementsPanel from "@/components/AchievementsPanel";
import { levelProgress } from "@/lib/xp";

export const metadata = {
  title: "Account settings",
  robots: { index: false, follow: false },
};

export default async function AccountPage({ searchParams }) {
  const { payment, type, reason } = await searchParams;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: subscriptions }, { data: purchases }, games] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, country, is_admin, is_premium, referral_code, bonus_subscription_until, platform_xp, lifetime_points")
      .eq("id", user.id)
      .single(),
    supabase
      .from("subscriptions")
      .select("status, plan_id, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id),
    supabase.from("purchases").select("game, purchased_at").eq("user_id", user.id),
    getGames(),
  ]);
  const admin = profile?.is_admin || (await isAdmin(supabase, user.id));

  const purchasesWithNames = (purchases || []).map((p) => ({
    ...p,
    gameName: games.find((g) => g.slug === p.game)?.name || p.game,
  }));

  const bonusActive = profile?.bonus_subscription_until && new Date(profile.bonus_subscription_until) > new Date();
  const xpProgress = levelProgress(profile?.platform_xp || 0);

  // Every subscription tier that actually has games behind it — shown
  // as fully independent options. A user can hold any combination of
  // these at once (each is its own row in subscriptions now).
  const tierMap = {};
  for (const g of games) {
    if (g.accessType === "subscription" && g.subscriptionPlanId) {
      if (!tierMap[g.subscriptionPlanId]) {
        tierMap[g.subscriptionPlanId] = {
          id: g.subscriptionPlanId,
          name: g.subscriptionPlanName || "Power Pass",
          priceDisplay: g.priceDisplay,
          count: 0,
        };
      }
      tierMap[g.subscriptionPlanId].count += 1;
    }
  }
  const tiers = Object.values(tierMap).sort((a, b) => (a.id === "premium" ? -1 : b.id === "premium" ? 1 : 0));

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={profile?.username || user.email} points={0} isAdmin={admin} />
      <div className="max-w-md mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-pixel text-sm text-textLight mb-1">ACCOUNT SETTINGS</h1>
        <p className="text-textDim text-sm mb-8">Your country is shown next to your name on leaderboards.</p>

        {payment === "success" && (
          <div className="mb-6 rounded-md border border-accentCyan/50 bg-accentCyan/10 p-3">
            <p className="font-mono text-[11px] text-accentCyan">
              ✅ Payment successful
              {type === "daypass" && " — your 24-hour pass is active."}
              {type === "onetime" && " — the game is unlocked."}
              {type === "subscription" && " — your subscription is active."}
            </p>
          </div>
        )}
        {payment === "failed" && (
          <div className="mb-6 rounded-md border border-accentMagenta/50 bg-accentMagenta/10 p-3">
            <p className="font-mono text-[11px] text-accentMagenta">
              {reason === "verification"
                ? "⚠️ Payment could not be verified — if you were charged, contact support and it'll be sorted out."
                : "❌ Payment didn't go through — no charge was made. Feel free to try again."}
            </p>
          </div>
        )}

        <AccountForm initialUsername={profile?.username || ""} initialCountry={profile?.country || ""} />

        {tiers.map((tier) => {
          const sub = (subscriptions || []).find((s) => s.plan_id === tier.id);
          const hasActiveSub = sub?.status === "active";
          // Referral/day-pass bonus time has only ever applied to the
          // base Power Pass tier — it's never been sold or priced for
          // Legend Pass, so it's deliberately not shown as covering it.
          const bonusAppliesHere = bonusActive && tier.id === "premium";

          return (
            <div key={tier.id} className="mt-8">
              <h2 className="font-pixel text-[10px] text-accentAmber mb-3">{tier.name.toUpperCase()} ACCESS</h2>
              {hasActiveSub ? (
                <SubscriptionBox subscription={sub} planId={tier.id} planName={tier.name} />
              ) : bonusAppliesHere ? (
                <div className="rounded-xl border border-accentCyan p-6 bg-bgPanel">
                  <p className="text-textDim text-xs mb-1">You have temporary {tier.name} access.</p>
                  <p className="text-[11px] text-accentCyan mb-1">
                    Active until <span className="text-textLight">{new Date(profile.bonus_subscription_until).toLocaleString("en-IN")}</span>
                    {" "}(from a referral or day pass — not a running subscription).
                  </p>
                  <p className="text-[11px] text-textDim mb-4">This covers all {tier.count} {tier.name} games, not just one.</p>
                  <SubscribeButton priceDisplay={tier.priceDisplay} planId={tier.id} planName={tier.name} />
                </div>
              ) : (
                <div className="rounded-xl border border-lineColor p-6 bg-bgPanel">
                  <p className="text-textDim text-xs mb-1">You're not subscribed to {tier.name}.</p>
                  <p className="text-[11px] text-textDim mb-4">
                    One subscription unlocks all {tier.count} {tier.name} games — subscribing through any single
                    game (or here) gives you every one of them, for as long as it's active.
                  </p>
                  <SubscribeButton priceDisplay={tier.priceDisplay} planId={tier.id} planName={tier.name} />
                </div>
              )}
            </div>
          );
        })}

        <div className="mt-8 rounded-xl border border-lineColor bg-bgPanel p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-pixel text-[11px] tracking-wide text-accentCyan">LEVEL {xpProgress.level}</h2>
            <p className="font-mono text-[11px] text-textDim">{(profile?.platform_xp || 0).toLocaleString()} XP</p>
          </div>
          <div className="h-2 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
            <div className="h-full bg-accentCyan" style={{ width: `${Math.round(xpProgress.progress * 100)}%` }} />
          </div>
          <p className="font-mono text-[10px] text-textDim mt-1.5">
            {(xpProgress.nextLevelFloor - (profile?.platform_xp || 0)).toLocaleString()} XP to level {xpProgress.level + 1}
          </p>
          <Link href={`/players/${encodeURIComponent(profile?.username || "")}`} className="font-mono text-[10px] text-accentCyan mt-3 inline-block">
            View your public profile →
          </Link>
        </div>

        <div className="mt-8">
          <AchievementsPanel />
        </div>

        <div className="mt-8">
          <h2 className="font-pixel text-[10px] text-accentAmber mb-1">24-HOUR PASS</h2>
          <p className="text-textDim text-xs mb-3">Not ready for a monthly Pass? Get full Power Pass access for one day, just ₹10.</p>
          <DayPassButton />
        </div>

        <div className="mt-8">
          <h2 className="font-pixel text-[10px] text-accentAmber mb-3">YOUR PURCHASES</h2>
          <PurchaseHistory purchases={purchasesWithNames} />
        </div>

        <div className="mt-8">
          <ReferralBox referralCode={profile?.referral_code} bonusUntil={profile?.bonus_subscription_until} />
        </div>

        <div className="mt-10 pt-6 border-t border-lineColor text-center font-mono text-[11px] text-textDim flex flex-wrap justify-center gap-4">
          <Link href="/feedback" className="text-accentCyan">Feedback</Link>
          <Link href="/terms" className="text-accentCyan">Terms</Link>
          <Link href="/privacy" className="text-accentCyan">Privacy</Link>
          <Link href="/refund-policy" className="text-accentCyan">Refunds</Link>
          <a href="mailto:support@tapandscore.com" className="text-accentCyan">Contact</a>
        </div>
      </div>
    </div>
  );
}
