// A user has access to a subscription-tier game if EITHER a real Fungies subscription is active for that tier (or a higher one),
// OR they've got unused referral bonus time covering it. Checking both here in one place keeps the game page and the scores API
// from drifting out of sync with each other.
//
// Upgrade 70: the tiers now build on each other. Legend Pass ("premium_plus") includes everything in Power Pass ("premium"),
// so a Legend subscriber can play Power Pass games too. Power Pass does NOT unlock the Legend flagships.
const COVERED_BY = { premium: ["premium", "premium_plus"], premium_plus: ["premium_plus"] };

function subIsLive(sub, now) {
  if (!sub || sub.status !== "active") return false;
  // A cancelled-but-still-active subscription keeps access only until the period they already paid for actually ends — a safety
  // net in case Fungies' cancellation webhook is ever late arriving.
  if (sub.cancel_at_period_end && sub.current_period_end) return new Date(sub.current_period_end) > now;
  return true;
}

export async function hasSubscriptionAccess(supabase, userId, planId, profile) {
  if (profile?.bonus_subscription_until && new Date(profile.bonus_subscription_until) > new Date()) {
    return true;
  }
  const plans = COVERED_BY[planId] || [planId];
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("status, plan_id, cancel_at_period_end, current_period_end")
    .eq("user_id", userId)
    .in("plan_id", plans);
  const now = new Date();
  return (subs || []).some((s) => subIsLive(s, now));
}

// The highest tier this player's subscriptions reach right now: "legend" | "power" | null (null = Free only).
export async function activeTier(supabase, userId, profile) {
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("status, plan_id, cancel_at_period_end, current_period_end")
    .eq("user_id", userId)
    .in("plan_id", ["premium", "premium_plus"]);
  const now = new Date();
  const live = (subs || []).filter((s) => subIsLive(s, now));
  if (live.some((s) => s.plan_id === "premium_plus")) return "legend";
  // referral bonus time opens every subscription game (see hasSubscriptionAccess above), so it reads as the top tier here too
  if (profile?.bonus_subscription_until && new Date(profile.bonus_subscription_until) > now) return "legend";
  if (live.some((s) => s.plan_id === "premium")) return "power";
  return null;
}

// Same access logic as above, but "is this user a subscriber at all" rather than "to this specific tier" — used by perks that
// apply to any paying subscriber regardless of plan (cosmetics, avatars, themes, VIP profile styling, tournament participation).
// Checks both plan ids rather than hardcoding one, so a Legend Pass subscriber gets these too, not just Power Pass.
export async function hasAnySubscription(supabase, userId, profile) {
  if (profile?.bonus_subscription_until && new Date(profile.bonus_subscription_until) > new Date()) {
    return true;
  }
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("status, cancel_at_period_end, current_period_end")
    .eq("user_id", userId)
    .in("plan_id", ["premium", "premium_plus"]);

  const now = new Date();
  return (subs || []).some((sub) => subIsLive(sub, now));
}
