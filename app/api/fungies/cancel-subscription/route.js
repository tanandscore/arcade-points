import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { cancelFungiesSubscription } from "@/lib/fungies";

// Cancels at the end of the current billing period ("endPeriod"),
// matching the same "keep access through what's already been paid
// for" behavior this project already uses for every other provider.
//
// PATCH /subscriptions/{id}/cancel, confirmed from Fungies' own
// "Managing Subscriptions through API" docs — requires both the
// public and secret API key headers (handled by lib/fungies.js).
//
// This has NOT been exercised against a
// real Fungies account from this environment. Test a real
// cancellation in Fungies' Test mode before relying on this in
// production.
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
    .select("status, provider, fungies_subscription_id, current_period_end, cancel_at_period_end")
    .eq("user_id", user.id)
    .eq("plan_id", planId)
    .maybeSingle();

  if (!sub || sub.status !== "active" || sub.provider !== "fungies" || !sub.fungies_subscription_id) {
    return NextResponse.json({ error: "You don't have an active Fungies subscription to cancel." }, { status: 400 });
  }
  if (sub.cancel_at_period_end) {
    return NextResponse.json({ error: "Your subscription is already set to cancel." }, { status: 400 });
  }

  try {
    await cancelFungiesSubscription(sub.fungies_subscription_id);
  } catch (err) {
    return NextResponse.json({ error: "Couldn't reach Fungies to cancel — please try again shortly." }, { status: 502 });
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
