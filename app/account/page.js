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

export const metadata = {
  title: "Account settings",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: subscription }, { data: purchases }, games] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, country, is_admin, is_premium, referral_code, bonus_subscription_until")
      .eq("id", user.id)
      .single(),
    supabase
      .from("subscriptions")
      .select("status, plan_id, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("purchases").select("game, purchased_at").eq("user_id", user.id),
    getGames(),
  ]);
  const admin = profile?.is_admin || (await isAdmin(supabase, user.id));

  const purchasesWithNames = (purchases || []).map((p) => ({
    ...p,
    gameName: games.find((g) => g.slug === p.game)?.name || p.game,
  }));

  const bonusActive = profile?.bonus_subscription_until && new Date(profile.bonus_subscription_until) > new Date();
  const hasActiveSubscription = subscription?.status === "active";
  const premiumCount = games.filter((g) => g.accessType === "subscription").length;

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={profile?.username || user.email} points={0} isAdmin={admin} />
      <div className="max-w-md mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-pixel text-sm text-textLight mb-1">ACCOUNT SETTINGS</h1>
        <p className="text-textDim text-sm mb-8">Your country is shown next to your name on leaderboards.</p>
        <AccountForm initialUsername={profile?.username || ""} initialCountry={profile?.country || ""} />

        <div className="mt-8">
          <h2 className="font-pixel text-[10px] text-accentAmber mb-3">PREMIUM ACCESS</h2>
          {hasActiveSubscription ? (
            <SubscriptionBox subscription={subscription} />
          ) : bonusActive ? (
            <div className="rounded-xl border border-accentCyan p-6 bg-bgPanel">
              <p className="text-textDim text-xs mb-1">You have temporary Premium access.</p>
              <p className="text-[11px] text-accentCyan mb-1">
                Active until <span className="text-textLight">{new Date(profile.bonus_subscription_until).toLocaleString("en-IN")}</span>
                {" "}(from a referral or day pass — not a running subscription).
              </p>
              <p className="text-[11px] text-textDim mb-4">This covers all {premiumCount} Premium games, not just one.</p>
              <SubscribeButton priceDisplay="₹100" />
            </div>
          ) : (
            <div className="rounded-xl border border-lineColor p-6 bg-bgPanel">
              <p className="text-textDim text-xs mb-1">You're not subscribed to Premium.</p>
              <p className="text-[11px] text-textDim mb-4">
                One subscription unlocks all {premiumCount} Premium games — subscribing through any single game
                (or here) gives you every one of them, for as long as it's active.
              </p>
              <SubscribeButton priceDisplay="₹100" />
            </div>
          )}
        </div>

        <div className="mt-8">
          <h2 className="font-pixel text-[10px] text-accentAmber mb-1">24-HOUR PASS</h2>
          <p className="text-textDim text-xs mb-3">Not ready for a monthly plan? Get full Premium access for one day, just ₹10.</p>
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
