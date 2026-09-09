import crypto from "crypto";
import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";

// Razorpay calls this URL directly (not the user's browser) whenever
// something happens to a subscription — a successful monthly charge,
// a failed charge, or a cancellation. This is the ONLY way the site
// finds out about renewals and failures that happen automatically via
// the UPI Autopay / card mandate, since the user isn't present for those.
//
// Set this up once: Razorpay dashboard -> Settings -> Webhooks ->
// Add endpoint -> https://tapandscore.com/api/razorpay/webhook,
// select the "subscription.*" events, and put the signing secret it
// gives you into the RAZORPAY_WEBHOOK_SECRET environment variable.
export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  if (expected !== signature) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const event = JSON.parse(body);
  const supabase = createServiceSupabase();
  const subscriptionEntity = event.payload?.subscription?.entity;

  if (!subscriptionEntity) {
    // Not a subscription event (could be a payment/order webhook if you
    // add more event types later) — acknowledge and ignore.
    return NextResponse.json({ received: true });
  }

  const userId = subscriptionEntity.notes?.user_id;
  if (!userId) {
    return NextResponse.json({ received: true });
  }

  let status = null;
  if (event.event === "subscription.activated" || event.event === "subscription.charged") {
    status = "active";
  } else if (event.event === "subscription.pending" || event.event === "subscription.halted") {
    status = "past_due";
  } else if (event.event === "subscription.cancelled" || event.event === "subscription.completed") {
    status = "cancelled";
  }

  if (status) {
    await supabase.from("subscriptions").upsert({
      user_id: userId,
      status,
      plan_id: subscriptionEntity.notes?.plan_id || null,
      razorpay_subscription_id: subscriptionEntity.id,
      current_period_end: subscriptionEntity.current_end
        ? new Date(subscriptionEntity.current_end * 1000).toISOString()
        : null,
      // Once Razorpay actually completes a cancellation, the "pending
      // cancellation" flag has served its purpose — clear it so a
      // future resubscribe starts clean.
      cancel_at_period_end: status === "cancelled" ? false : undefined,
      updated_at: new Date().toISOString(),
    });
    // Keeps the public profiles.is_premium flag (used for leaderboard
    // badges) accurate as renewals succeed or the subscription lapses.
    await supabase.from("profiles").update({ is_premium: status === "active" }).eq("id", userId);
  }

  return NextResponse.json({ received: true });
}
