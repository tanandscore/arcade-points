import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import { getGames } from "@/lib/games";
import AccountForm from "@/components/account/AccountForm";
import ReferralBox from "@/components/account/ReferralBox";
import StreakEmailToggle from "@/components/account/StreakEmailToggle";
import DeleteAccountSection from "@/components/account/DeleteAccountSection";
import PrivacyDataSection from "@/components/account/PrivacyDataSection";
import SubscriptionBox from "@/components/account/SubscriptionBox";
import FungiesSubscribeButton from "@/components/account/FungiesSubscribeButton";
import PurchaseHistory from "@/components/account/PurchaseHistory";
import BillingHistory from "@/components/account/BillingHistory";
import Navbar from "@/components/Navbar";
import AchievementsPanel from "@/components/AchievementsPanel";
import PerksPanel from "@/components/account/PerksPanel";
import { levelProgress } from "@/lib/xp";
import { hasAnySubscription } from "@/lib/access";
import { TIERS } from "@/lib/catalog";

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

  const [{ data: profile }, { data: subscriptions }, { data: purchases }, games, { data: payments }, { data: scoreRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, country, is_admin, is_premium, referral_code, bonus_subscription_until, platform_xp, lifetime_points, avatar_id, theme_id, cosmetic_badge, streak_email_opt_out")
      .eq("id", user.id)
      .single(),
    supabase
      .from("subscriptions")
      .select("status, plan_id, current_period_end, cancel_at_period_end, fungies_customer_id, provider")
      .eq("user_id", user.id),
    supabase.from("purchases").select("game, purchased_at").eq("user_id", user.id),
    getGames(),
    supabase.from("payment_history").select("id, plan_id, price_label, paid_at").eq("user_id", user.id).order("paid_at", { ascending: false }).limit(50),
    supabase.from("scores").select("score").eq("user_id", user.id),
  ]);
  const admin = profile?.is_admin || (await isAdmin(supabase, user.id));
  const totalPoints = (scoreRows || []).reduce((sum, r) => sum + (r.score || 0), 0);

  const purchasesWithNames = (purchases || []).map((p) => ({
    ...p,
    gameName: games.find((g) => g.slug === p.game)?.name || p.game,
  }));

  const planNames = { premium: "Power Pass", premium_plus: "Legend Pass" };
  const paymentsWithNames = (payments || []).map((p) => ({ ...p, planName: planNames[p.plan_id] || p.plan_id || "Subscription" }));

  const bonusActive = profile?.bonus_subscription_until && new Date(profile.bonus_subscription_until) > new Date();
  // Admins get every subscriber perk (avatars, themes, cosmetics)
  // without an actual paid subscription — the same bypass used for
  // game access elsewhere on the site, applied here too.
  const isSubscriber = admin || (await hasAnySubscription(supabase, user.id, profile));
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
          fungiesCheckoutUrlMonthly: g.subscriptionPlanFungiesCheckoutUrlMonthly,
          fungiesCheckoutUrlAnnual: g.subscriptionPlanFungiesCheckoutUrlAnnual,
          fungiesPriceDisplayMonthly: g.subscriptionPlanFungiesPriceDisplayMonthly,
          fungiesPriceDisplayAnnual: g.subscriptionPlanFungiesPriceDisplayAnnual,
          count: 0,
        };
      }
      tierMap[g.subscriptionPlanId].count += 1;
    }
  }
  const tiers = Object.values(tierMap).sort((a, b) => (a.id === "premium" ? -1 : b.id === "premium" ? 1 : 0));

  const username = profile?.username || user.email;
  const initial = (username || "?").trim().charAt(0).toUpperCase();
  const xp = profile?.platform_xp || 0;
  const tierKeyFor = (planId) => Object.keys(TIERS).find((k) => TIERS[k].planId === planId) || "power";

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <Navbar username={username} points={totalPoints} isAdmin={admin} />
      <main className="st-container pt-8 pb-16">
        <h1 className="st-h1" style={{ fontSize: "clamp(2rem, 4.4vw, 3.1rem)" }}>Account</h1>
        <p className="st-muted mt-2 text-[15.5px]">Your profile, plan and privacy in one place.</p>

        {payment === "success" && (
          <div role="status" className="mt-6 rounded-2xl p-4" style={{ background: "rgba(62,230,224,.1)", boxShadow: "inset 0 0 0 1px rgba(62,230,224,.45)" }}>
            <p className="text-[14.5px] text-accentCyan font-semibold">
              Payment successful
              {type === "daypass" && ". Your 24-hour pass is active."}
              {type === "onetime" && ". The game is unlocked."}
              {type === "subscription" && ". Your subscription is active."}
            </p>
          </div>
        )}
        {payment === "failed" && (
          <div role="alert" className="mt-6 rounded-2xl p-4" style={{ background: "rgba(255,62,165,.1)", boxShadow: "inset 0 0 0 1px rgba(255,62,165,.45)" }}>
            <p className="text-[14.5px] text-accentMagenta font-semibold">
              {reason === "verification"
                ? "We could not verify that payment. If you were charged, contact support and we will sort it out."
                : "That payment did not go through and no charge was made. You are welcome to try again."}
            </p>
          </div>
        )}

        <section className="st-panel mt-6 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8" aria-label="Your level">
          <div className="flex items-center gap-4 min-w-0">
            <span className="w-16 h-16 rounded-full flex items-center justify-center font-display font-extrabold text-[26px] text-[#0c0620] shrink-0" style={{ background: "linear-gradient(135deg,#3ee6e0,#ff3ea5)" }} aria-hidden>{initial}</span>
            <div className="min-w-0">
              <p className="st-h2 truncate">{username}</p>
              <Link href={`/players/${encodeURIComponent(profile?.username || "")}`} className="st-link text-[13.5px]">View your public profile</Link>
            </div>
          </div>
          <div className="sm:ml-auto w-full sm:max-w-[340px]">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display font-bold text-[16px]">Level {xpProgress.level}</p>
              <p className="st-muted text-[13px]">{xp.toLocaleString()} XP</p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(xpProgress.progress * 100)} aria-label="Progress to the next level">
              <div className="h-full rounded-full bg-accentCyan" style={{ width: `${Math.round(xpProgress.progress * 100)}%` }} />
            </div>
            <p className="st-muted text-[12.5px] mt-1.5">{(xpProgress.nextLevelFloor - xp).toLocaleString()} XP to level {xpProgress.level + 1}</p>
          </div>
        </section>

        <div className="mt-10 grid lg:grid-cols-[minmax(0,1fr)_380px] gap-10 lg:gap-12 items-start">
          <div className="space-y-12 min-w-0">
            <section aria-labelledby="plan-h">
              <h2 id="plan-h" className="st-h2">Your plan</h2>
              <p className="st-muted text-[14.5px] mt-1.5 max-w-[60ch]">Every pass includes the games below it. Power Pass includes Free, and Legend Pass includes Power Pass and Free.</p>
              <div className="mt-5 grid md:grid-cols-2 gap-4">
                {tiers.map((tier) => {
                  const key = tierKeyFor(tier.id);
                  const t = TIERS[key];
                  const sub = (subscriptions || []).find((x) => x.plan_id === tier.id);
                  const hasActiveSub = sub?.status === "active";
                  // Referral/day-pass bonus time has only ever applied to the base Power Pass tier — it's never been sold or priced
                  // for Legend Pass, so it's deliberately not shown as covering it.
                  const bonusAppliesHere = bonusActive && tier.id === "premium";
                  const status = hasActiveSub ? (sub.cancel_at_period_end ? "Ends soon" : "Active") : bonusAppliesHere ? "Temporary access" : null;
                  const buy = (
                    <FungiesSubscribeButton
                      fungiesCheckoutUrlMonthly={tier.fungiesCheckoutUrlMonthly}
                      fungiesCheckoutUrlAnnual={tier.fungiesCheckoutUrlAnnual}
                      priceDisplayMonthly={tier.fungiesPriceDisplayMonthly}
                      priceDisplayAnnual={tier.fungiesPriceDisplayAnnual}
                      planId={tier.id}
                      planName={t.name}
                      userId={user.id}
                      accent={t.color}
                    />
                  );
                  return (
                    <article key={tier.id} className="st-panel p-5 sm:p-6 flex flex-col" style={{ boxShadow: `inset 0 3px 0 ${t.color}`, "--acc": t.color }} aria-label={t.name}>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="st-h2" style={{ color: t.color }}>{t.name}</h3>
                        {status && <span className="st-tier shrink-0" style={{ "--tc": t.color, "--tcb": `${t.color}99` }}>{status}</span>}
                      </div>
                      <p className="st-muted text-[14px] mt-1.5 leading-relaxed md:min-h-[3.3rem]">{t.blurb}</p>
                      <div className="mt-5 pt-5 border-t border-white/10 flex-1">
                        {hasActiveSub ? (
                          <SubscriptionBox
                            subscription={sub}
                            planId={tier.id}
                            planName={t.name}
                            userId={user.id}
                            fungiesCheckoutUrlMonthly={tier.fungiesCheckoutUrlMonthly}
                            fungiesCheckoutUrlAnnual={tier.fungiesCheckoutUrlAnnual}
                            priceDisplayMonthly={tier.fungiesPriceDisplayMonthly}
                            priceDisplayAnnual={tier.fungiesPriceDisplayAnnual}
                            accent={t.color}
                          />
                        ) : bonusAppliesHere ? (
                          <>
                            <p className="text-[14.5px] text-[#f5f0ff] leading-relaxed">
                              You have temporary {t.name} access until{" "}
                              <span className="font-semibold">{new Date(profile.bonus_subscription_until).toLocaleString("en-IN")}</span>.
                            </p>
                            <p className="st-muted text-[13.5px] mt-1.5 mb-4 leading-relaxed">It comes from a referral or a day pass, not a running subscription, and it covers every {t.name} game.</p>
                            {buy}
                          </>
                        ) : (
                          <>
                            <p className="text-[14.5px] text-[#f5f0ff] mb-4">You are not subscribed to {t.name}.</p>
                            {buy}
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="perks-h">
              <h2 id="perks-h" className="st-h2">Subscriber perks</h2>
              <p className="st-muted text-[14.5px] mt-1.5 mb-5 max-w-[60ch]">
                Animated avatars, exclusive cosmetics, premium themes and VIP profile styling, included with any active subscription.
              </p>
              <PerksPanel
                isSubscriber={isSubscriber}
                username={profile?.username}
                currentAvatarId={profile?.avatar_id}
                currentThemeId={profile?.theme_id}
                currentBadgeId={profile?.cosmetic_badge}
              />
            </section>

            <AchievementsPanel />

            <section aria-labelledby="billing-h">
              <h2 id="billing-h" className="st-h2 mb-4">Purchases and billing</h2>
              <h3 className="st-h3 mb-2.5">Your purchases</h3>
              <PurchaseHistory purchases={purchasesWithNames} />
              <h3 className="st-h3 mt-7 mb-2.5">Billing history</h3>
              <BillingHistory payments={paymentsWithNames} />
            </section>
          </div>

          <aside className="space-y-6 min-w-0" aria-label="Profile and privacy">
            <AccountForm initialUsername={profile?.username || ""} initialCountry={profile?.country || ""} />
            <ReferralBox referralCode={profile?.referral_code} bonusUntil={profile?.bonus_subscription_until} />
            <StreakEmailToggle initialOptOut={profile?.streak_email_opt_out} />
            <PrivacyDataSection />
            <DeleteAccountSection username={profile?.username || ""} />
          </aside>
        </div>
      </main>
    </div>
  );
}
