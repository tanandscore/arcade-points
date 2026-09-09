import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";

// Cancels at the end of the current billing period (Paddle's own
// default when effective_from is omitted, sent explicitly here for
// clarity) — matching the exact same "keep access through what's
// already been paid for" behavior as /api/razorpay/cancel-subscription.
//
// This calls Paddle's REST API directly with a plain fetch rather
// than going through the Node SDK, on purpose: the SDK's exact method
// name and signature for this one operation couldn't be confirmed
// from its public README examples (only .update(), .get(), and
// .list() were shown for subscriptions, not .cancel()), whereas the
// REST endpoint itself — POST /subscriptions/{id}/cancel — is fully
// documented and verified. A direct call to a confirmed endpoint beat
// guessing at an unconfirmed SDK method name for something this
// consequential.
//
// Like the webhook handler, this has NOT been exercised against a
// real Paddle sandbox account — there's no way to do that from this
// environment. Test a real cancellation in the Paddle sandbox before
// relying on this in production.
export async function POST(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { planId } = await request.json();
  if (!planId) {
    return NextResponse.json({ error: "Missing planId." }, { status: 400 });
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, provider, paddle_subscription_id, current_period_end, cancel_at_period_end")
    .eq("user_id", user.id)
    .eq("plan_id", planId)
    .maybeSingle();

  if (!sub || sub.status !== "active" || sub.provider !== "paddle" || !sub.paddle_subscription_id) {
    return NextResponse.json({ error: "You don't have an active Paddle subscription to cancel." }, { status: 400 });
  }
  if (sub.cancel_at_period_end) {
    return NextResponse.json({ error: "Your subscription is already set to cancel." }, { status: 400 });
  }

  const baseUrl = process.env.PADDLE_ENVIRONMENT === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";

  try {
    const response = await fetch(`${baseUrl}/subscriptions/${sub.paddle_subscription_id}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ effective_from: "next_billing_period" }),
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Couldn't reach Paddle to cancel — please try again shortly." }, { status: 502 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Couldn't reach Paddle to cancel — please try again shortly." }, { status: 502 });
  }

  const service = createServiceSupabase();
  const { error } = await service
    .from("subscriptions")
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("plan_id", planId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, periodEnd: sub.current_period_end });
}
