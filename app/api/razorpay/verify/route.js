import crypto from "crypto";
import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { getRazorpay } from "@/lib/razorpay";

export async function POST(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json();
  const { razorpay_payment_id, razorpay_signature, razorpay_order_id, razorpay_subscription_id } = body;

  if (!razorpay_payment_id || !razorpay_signature || (!razorpay_order_id && !razorpay_subscription_id)) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }

  const serviceSupabase = createServiceSupabase();

  // ---------- Subscription (Premium) confirmation ----------
  if (razorpay_subscription_id) {
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
    }

    const subscription = await getRazorpay().subscriptions.fetch(razorpay_subscription_id);
    if (subscription.notes?.user_id !== user.id) {
      return NextResponse.json({ error: "This subscription doesn't belong to your account." }, { status: 403 });
    }

    const { error } = await serviceSupabase.from("subscriptions").upsert({
      user_id: user.id,
      status: "active",
      plan_id: subscription.notes?.plan_id || null,
      razorpay_subscription_id,
      current_period_end: subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Keeps the public profiles.is_premium flag (used for leaderboard
    // badges) in sync without exposing the private subscriptions table.
    await serviceSupabase.from("profiles").update({ is_premium: true }).eq("id", user.id);
    return NextResponse.json({ success: true, type: "subscription" });
  }

  // ---------- One-time purchase confirmation ----------
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
  }

  const order = await getRazorpay().orders.fetch(razorpay_order_id);
  if (order.notes?.user_id !== user.id) {
    return NextResponse.json({ error: "This payment doesn't belong to your account." }, { status: 403 });
  }

  // Day pass: 24 hours of full Premium access, stacking with any
  // existing bonus time — the same mechanism referrals use, just a
  // shorter, paid grant instead of a free earned one.
  if (order.notes?.type === "daypass") {
    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("bonus_subscription_until")
      .eq("id", user.id)
      .single();
    const base = profile?.bonus_subscription_until && new Date(profile.bonus_subscription_until) > new Date()
      ? new Date(profile.bonus_subscription_until)
      : new Date();
    const newExpiry = new Date(base.getTime() + 24 * 60 * 60 * 1000);

    const { error } = await serviceSupabase
      .from("profiles")
      .update({ bonus_subscription_until: newExpiry.toISOString() })
      .eq("id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, type: "daypass", expiresAt: newExpiry.toISOString() });
  }

  const game = order.notes?.game;
  const { error } = await serviceSupabase.from("purchases").upsert({ user_id: user.id, game });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, type: "onetime", game });
}
