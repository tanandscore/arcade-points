import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { getRazorpay } from "@/lib/razorpay";

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, razorpay_subscription_id, current_period_end, cancel_at_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sub || sub.status !== "active" || !sub.razorpay_subscription_id) {
    return NextResponse.json({ error: "You don't have an active subscription to cancel." }, { status: 400 });
  }
  if (sub.cancel_at_period_end) {
    return NextResponse.json({ error: "Your subscription is already set to cancel." }, { status: 400 });
  }

  try {
    // `true` here means "cancel at the end of the current billing
    // cycle" rather than immediately — this is what keeps access alive
    // through the period already paid for.
    await getRazorpay().subscriptions.cancel(sub.razorpay_subscription_id, true);
  } catch (err) {
    return NextResponse.json({ error: "Couldn't reach Razorpay to cancel — please try again shortly." }, { status: 502 });
  }

  const service = createServiceSupabase();
  const { error } = await service
    .from("subscriptions")
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, periodEnd: sub.current_period_end });
}
