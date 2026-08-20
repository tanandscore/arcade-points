import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getRazorpay } from "@/lib/razorpay";
import { getGame, getSubscriptionPlan } from "@/lib/games";

// Creates a Razorpay Subscription for whichever tier the requested
// game belongs to — the Plan ID comes from the subscription_plans
// table, not a fixed environment variable, so changing which Razorpay
// Plan a tier uses (e.g. after a price change) is a database edit,
// not a code change.
export async function POST(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { game } = await request.json();
  const gameDef = await getGame(game);

  if (!gameDef || gameDef.accessType !== "subscription" || !gameDef.subscriptionPlanId) {
    return NextResponse.json({ error: "This game isn't a subscription game." }, { status: 400 });
  }

  const plan = await getSubscriptionPlan(gameDef.subscriptionPlanId);
  if (!plan || !plan.razorpay_plan_id) {
    return NextResponse.json(
      { error: "This subscription isn't set up yet — add a Razorpay Plan ID for it in the subscription_plans table." },
      { status: 500 }
    );
  }

  const subscription = await getRazorpay().subscriptions.create({
    plan_id: plan.razorpay_plan_id,
    customer_notify: 1,
    // Razorpay requires a total_count of billing cycles — 600 months
    // (50 years) stands in for "until the user cancels."
    total_count: 600,
    notes: { user_id: user.id, plan_id: plan.id },
  });

  return NextResponse.json({
    subscriptionId: subscription.id,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
}
