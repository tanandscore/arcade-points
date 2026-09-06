import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { getPayuCredentials, generateVerifyHash } from "@/lib/payu";

// PayU redirects the user's browser here with a POST after a
// successful payment — this is a full-page navigation back from
// PayU's domain, not a client-side callback, so this route both
// verifies the payment AND redirects to a page the user actually
// sees. The reverse hash is checked before anything is granted —
// this is the one thing standing between "PayU said this succeeded"
// and someone simply POSTing a forged success request directly.
export async function POST(request) {
  const { salt, key } = getPayuCredentials();
  const service = createServiceSupabase();

  const formData = await request.formData();
  const fields = Object.fromEntries(formData.entries());
  const { status, txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5, hash, mihpayid } = fields;

  const expectedHash = generateVerifyHash({
    salt,
    status,
    udf1: udf1 || "",
    udf2: udf2 || "",
    udf3: udf3 || "",
    udf4: udf4 || "",
    udf5: udf5 || "",
    email,
    firstname,
    productinfo,
    amount,
    txnid,
    key,
  });

  const origin = new URL(request.url).origin;

  if (expectedHash !== hash) {
    // Never grant anything on a hash mismatch — this is exactly the
    // check that stops a forged request from unlocking a subscription
    // or a game for free.
    return NextResponse.redirect(`${origin}/account?payment=failed&reason=verification`);
  }

  if (status !== "success") {
    return NextResponse.redirect(`${origin}/account?payment=failed`);
  }

  const userId = udf3;
  if (!userId) {
    return NextResponse.redirect(`${origin}/account?payment=failed&reason=missing_user`);
  }

  if (udf1 === "daypass") {
    const { data: profile } = await service.from("profiles").select("bonus_subscription_until").eq("id", userId).single();
    const base =
      profile?.bonus_subscription_until && new Date(profile.bonus_subscription_until) > new Date()
        ? new Date(profile.bonus_subscription_until)
        : new Date();
    const newExpiry = new Date(base.getTime() + 24 * 60 * 60 * 1000);
    await service.from("profiles").update({ bonus_subscription_until: newExpiry.toISOString() }).eq("id", userId);
    return NextResponse.redirect(`${origin}/account?payment=success&type=daypass`);
  }

  if (udf1 === "onetime") {
    const game = udf2;
    await service.from("purchases").upsert({ user_id: userId, game });
    return NextResponse.redirect(`${origin}/account?payment=success&type=onetime`);
  }

  if (udf1 === "subscription") {
    const planId = udf2;
    await service.from("subscriptions").upsert({
      user_id: userId,
      status: "active",
      plan_id: planId,
      payu_txnid: txnid,
      // Stored for a future mandate-cancellation call (PayU's
      // "cancel_transaction" API needs this, their own reference —
      // not the txnid we generated) — not yet used for anything,
      // see app/api/payu/cancel-subscription/route.js for why.
      payu_mihpayid: mihpayid || null,
      // First cycle only — ongoing renewal dates are updated by the
      // recurring-charge webhook once PayU's mandate lifecycle
      // starts firing (see the honesty note in app/api/payu/webhook/route.js).
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
    await service.from("profiles").update({ is_premium: true }).eq("id", userId);
    return NextResponse.redirect(`${origin}/account?payment=success&type=subscription`);
  }

  return NextResponse.redirect(`${origin}/account?payment=success`);
}
