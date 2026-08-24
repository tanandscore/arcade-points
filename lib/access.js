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
