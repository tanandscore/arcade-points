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
    .select("status, plan_id")
    .eq("user_id", userId)
    .maybeSingle();
  return sub?.status === "active" && sub?.plan_id === planId;
}
