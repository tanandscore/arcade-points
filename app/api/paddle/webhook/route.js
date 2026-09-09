import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { getPaddle } from "@/lib/paddle";

// Paddle calls this URL directly (not the user's browser) whenever a
// subscription changes state — activation, a renewal charge, a failed
// payment, a cancellation. Same role as /api/razorpay/webhook, for
// the Paddle side of things.
//
// Set this up once: Paddle dashboard -> Developer tools ->
// Notifications -> New destination -> https://tapandscore.com/api/paddle/webhook,
// select the subscription.* and transaction.completed events, and put
// the secret key it gives you into the PADDLE_WEBHOOK_SECRET
// environment variable.
//
// Uses the official SDK's webhooks.unmarshal(), which verifies the
// HMAC-SHA256 signature in the Paddle-Signature header and parses the
// event in one call — deliberately not hand-rolled crypto here, since
// getting a payment webhook's signature check wrong either accepts
// forged events or silently drops real ones.
//
// One thing worth being upfront about: this was written against
// Paddle's documented API and SDK behavior, verified via their
// current docs, but has NOT been exercised against a real Paddle
// sandbox account — there's no way to do that from this environment.
// Test this for real against Paddle's webhook simulator (Developer
// tools -> Notifications -> your destination -> Simulate) before
// relying on it in production.
export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get("paddle-signature") || "";

  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let eventData;
  try {
    eventData = await getPaddle().webhooks.unmarshal(rawBody, process.env.PADDLE_WEBHOOK_SECRET, signature);
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const eventType = eventData.eventType;
  const data = eventData.data;

  if (eventType && eventType.startsWith("subscription.")) {
    const userId = data?.customData?.user_id;
    const planId = data?.customData?.plan_id;

    if (!userId || !planId) {
      // No user_id or plan_id in custom data means this subscription
      // wasn't created through our checkout flow (or customData was
      // lost somewhere) — nothing reliable to link it to. plan_id is
      // part of this table's composite primary key (user_id, plan_id),
      // so upserting with it missing risks a null-key write rather
      // than correctly updating the existing row. Acknowledge and
      // ignore, same as the Razorpay webhook does for events it can't use.
      return NextResponse.json({ received: true });
    }

    // Paddle's own status field is the source of truth here, not a
    // manual event-type-to-status mapping table — that avoids missing
    // or mis-mapping any of Paddle's states (trialing, paused, etc.)
    // that a hand-built table might not account for. Normalized to
    // the app's existing British "cancelled" spelling, matching the
    // copy already used in SubscriptionBox.js and the DB's own check
    // constraint, since Paddle's API itself uses American "canceled".
    const rawStatus = data?.status;
    const status = rawStatus === "canceled" ? "cancelled" : rawStatus;

    if (status) {
      await supabase.from("subscriptions").upsert({
        user_id: userId,
        plan_id: planId,
        status,
        provider: "paddle",
        paddle_subscription_id: data.id,
        paddle_customer_id: data.customerId || null,
        current_period_end: data?.currentBillingPeriod?.endsAt || null,
        cancel_at_period_end: status === "cancelled" ? false : undefined,
        updated_at: new Date().toISOString(),
      });
      // Keeps the public profiles.is_premium flag (used for
      // leaderboard badges) accurate, same as the Razorpay webhook.
      await supabase.from("profiles").update({ is_premium: status === "active" }).eq("id", userId);
    }
  } else if (eventType === "transaction.completed") {
    // One-time ("day pass" style) purchases — a completed transaction
    // that isn't tied to a subscription. Custom data here would carry
    // whatever the frontend passed for a one-time buy; left as a
    // clearly-marked follow-up rather than guessed at, since this
    // site's one-time-purchase flow (day-pass) hasn't been wired to
    // Paddle yet — see the honesty note in the day-pass route.
  }

  return NextResponse.json({ received: true });
}
