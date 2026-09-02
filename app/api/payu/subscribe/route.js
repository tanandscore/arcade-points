import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { getGame, getSubscriptionPlan } from "@/lib/games";
import { getPayuCredentials, getPayuCheckoutUrl, generateTxnId, generateSiPaymentHash } from "@/lib/payu";

// Creates a PayU Standing Instruction (SI) mandate request — PayU's
// equivalent of Razorpay's recurring subscription, using UPI Autopay
// or a saved card to auto-charge each billing cycle. The FIRST
// payment (registering the mandate) uses the hash formula and flow
// verified here. Recurring charges for month 2 onward are driven by
// PayU's own mandate lifecycle and reported via webhook — see the
// honesty note in app/api/payu/webhook/route.js about what's been
// verified against PayU's current docs versus what genuinely needs
// real sandbox testing before relying on it for live renewals.
export async function POST(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { key, salt } = getPayuCredentials();
  if (!key || !salt) {
    return NextResponse.json({ error: "Payments aren't configured yet — missing PayU credentials." }, { status: 500 });
  }

  const { data: profile } = await supabase.from("profiles").select("username, phone").eq("id", user.id).single();
  const { game, planId: requestedPlanId, phone } = await request.json();

  let phoneToUse = profile?.phone;
  if (!phoneToUse) {
    if (typeof phone !== "string" || !/^[0-9]{10}$/.test(phone.trim())) {
      return NextResponse.json({ error: "phone_required", message: "Enter a 10-digit phone number to continue." }, { status: 400 });
    }
    phoneToUse = phone.trim();
    const service = createServiceSupabase();
    await service.from("profiles").update({ phone: phoneToUse }).eq("id", user.id);
  }

  let planId = requestedPlanId;
  if (!planId) {
    const gameDef = await getGame(game);
    if (!gameDef || gameDef.accessType !== "subscription" || !gameDef.subscriptionPlanId) {
      return NextResponse.json({ error: "This game isn't a subscription game." }, { status: 400 });
    }
    planId = gameDef.subscriptionPlanId;
  }

  const plan = await getSubscriptionPlan(planId);
  if (!plan) {
    return NextResponse.json({ error: "This subscription plan doesn't exist." }, { status: 400 });
  }

  const amount = (plan.price_paise / 100).toFixed(2);
  const txnid = generateTxnId("SUB");
  const firstname = profile?.username || "player";
  const email = user.email;

  const today = new Date();
  const endDate = new Date(today);
  endDate.setFullYear(endDate.getFullYear() + 5); // "until cancelled" stand-in, same reasoning as Razorpay's 600-month total_count

  const siDetails = {
    billingAmount: amount,
    billingCurrency: "INR",
    billingCycle: "MONTHLY",
    billingInterval: 1,
    paymentStartDate: today.toISOString().slice(0, 10),
    paymentEndDate: endDate.toISOString().slice(0, 10),
  };

  const udf1 = "subscription";
  const udf2 = plan.id;
  const udf3 = user.id;

  const hash = generateSiPaymentHash({ key, txnid, amount, productinfo: `Tap & Score — ${plan.name}`, firstname, email, udf1, udf2, udf3, siDetails, salt });

  const origin = new URL(request.url).origin;

  return NextResponse.json({
    checkoutUrl: getPayuCheckoutUrl(),
    fields: {
      key,
      txnid,
      amount,
      productinfo: `Tap & Score — ${plan.name}`,
      firstname,
      email,
      phone: phoneToUse,
      surl: `${origin}/api/payu/success`,
      furl: `${origin}/api/payu/failure`,
      udf1,
      udf2,
      udf3,
      si: "1",
      si_details: JSON.stringify(siDetails),
      hash,
    },
  });
}
