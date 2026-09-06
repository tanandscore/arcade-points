// A user has access to a subscription-tier game if EITHER a real
// Razorpay subscription is active for that tier, OR they've got unused
// referral bonus time covering the same tier. Checking both here in
// one place keeps the game page and the scores API from drifting out
// of sync with each other.
export async function hasSubscriptionAccess(supabase, userId, planId, profile) {
  if (profile?.bonus_subscription_until && new Date(profile.bonus_subscription_until) > new Date()) {
    return true;
  }
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, plan_id, cancel_at_period_end, current_period_end")
    .eq("user_id", userId)
    .eq("plan_id", planId)
    .maybeSingle();

  if (!sub || sub.status !== "active") return false;

  // A cancelled-but-still-active subscription keeps access only until
  // the period they already paid for actually ends — a safety net in
  // case Razorpay's cancellation webhook is ever late arriving.
  if (sub.cancel_at_period_end && sub.current_period_end) {
    return new Date(sub.current_period_end) > new Date();
  }

  return true;
}

// Same access logic as above, but "is this user a subscriber at all"
// rather than "to this specific tier" — used by perks that apply to
// any paying subscriber regardless of plan (cosmetics, avatars,
// themes, VIP profile styling, tournament participation). Checks
// both plan ids rather than hardcoding one, so a Legend Pass
// subscriber gets these too, not just Power Pass.
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
  return (subs || []).some((sub) => {
    if (sub.status !== "active") return false;
    if (sub.cancel_at_period_end && sub.current_period_end) return new Date(sub.current_period_end) > now;
    return true;
  });
}
