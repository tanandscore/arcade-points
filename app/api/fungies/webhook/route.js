import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { verifyFungiesWebhookSignature, getFungiesSubscription } from "@/lib/fungies";

// Fungies calls this URL directly (not the customer's browser)
// whenever an order or subscription event happens.
//
// Set this up once: Fungies dashboard -> Developers -> Webhooks ->
// Create a webhook -> URL https://tapandscore.com/api/fungies/webhook
// -> events: at minimum payment_success, subscription_updated,
// subscription_cancelled (subscription_created alone is NOT enough —
// Fungies' own docs say its payment status may still be pending).
// Put the secret it gives you into FUNGIES_WEBHOOK_SECRET.
//
// Signature verification: x-fngs-signature header, "sha256_" + an
// HMAC-SHA256 hex digest over the RAW body — see lib/fungies.js.
// That's why this reads request.text() first and never
// request.json() directly; parsing before verifying is explicitly
// called out in Fungies' own docs as a cause of signature mismatches.
//
// This was written against
// Fungies' current documented behavior but has NOT been exercised
// against a real Fungies account — there's no way to do that from
// this environment. Test it for real (Fungies' dashboard lets you
// resend/replay a test-mode event) before relying on it in
// production.
export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-fngs-signature") || "";
  const secret = process.env.FUNGIES_WEBHOOK_SECRET;

  if (!signature || !secret || !verifyFungiesWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const eventType = event?.type;
  const data = event?.data || {};

  if (eventType === "payment_success") {
    // The event to actually fulfill on — Fungies' own docs are
    // explicit that subscription_created alone can't be trusted,
    // since its first payment may still be PENDING.
    const subscriptionId = data?.subscription?.id;
    const fungiesCustomerId = data?.customer?.id || data?.user?.id || null;

    // Our own user_id/plan_id are passed through as checkout custom
    // fields (see FungiesSubscribeButton.js) and come back under
    // data.items[].customFields — Fungies only forwards keys that
    // exactly match a Custom Field configured in the dashboard, so
    // this requires a "user_id" and "plan_id" custom field to exist
    // there first (see the README note added alongside this file).
    const itemWithFields = (data?.items || []).find((item) => item?.customFields?.user_id);
    const userId = itemWithFields?.customFields?.user_id;
    let planId = itemWithFields?.customFields?.plan_id;
    // Do not just trust the plan name that came with the link (a shopper could edit it): work out the plan from the
    // Fungies offer that was really paid for, by matching its id against our saved checkout links.
    let priceLabel = null;
    try {
      const paid = JSON.stringify(data?.items || []).toLowerCase();
      const { data: plans } = await supabase.from("subscription_plans").select("id, fungies_checkout_url_monthly, fungies_checkout_url_annual, fungies_price_display_monthly, fungies_price_display_annual");
      for (const pl of plans || []) {
        for (const [u, price, per] of [[pl.fungies_checkout_url_monthly, pl.fungies_price_display_monthly, "month"], [pl.fungies_checkout_url_annual, pl.fungies_price_display_annual, "year"]]) {
          const m = u && String(u).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
          if (m && paid.includes(m[0].toLowerCase())) { planId = pl.id; priceLabel = price ? `${price} / ${per}` : null; }
        }
      }
    } catch { /* keep the plan name from the link */ }

    // Remember this payment for the Account page's Billing history. Never allowed to break the webhook itself.
    if (userId && planId) {
      try {
        const payId = String(data?.orderId || data?.order?.id || data?.paymentId || data?.id || "") || null;
        const row = { user_id: userId, plan_id: planId, price_label: priceLabel, provider: "fungies", provider_payment_id: payId, paid_at: new Date().toISOString() };
        const { error: histErr } = payId
          ? await supabase.from("payment_history").upsert(row, { onConflict: "provider,provider_payment_id", ignoreDuplicates: true })
          : await supabase.from("payment_history").insert(row);
        if (histErr) console.error("payment_history:", histErr.message);
      } catch (e) { console.error("payment_history:", e?.message); }
    }

    if (!subscriptionId) {
      // A one-time purchase (day-pass/onetime game), not a
      // subscription — not wired up yet on this site's Fungies flow.
      // Left as a clearly-marked follow-up rather than guessed at.
      return NextResponse.json({ received: true });
    }

    if (!userId || !planId) {
      // No way to link this payment to one of our users — nothing
      // reliable to act on. Acknowledge and ignore.
      return NextResponse.json({ received: true });
    }

    // Fetch the authoritative subscription state rather than trusting
    // webhook payload shape for period-end/cancel-at-period-end,
    // per Fungies' own guidance.
    // The message itself carries the subscription (status, period end...) and is signed by Fungies, so it is trusted.
    // Asking Fungies for the latest copy is a bonus: if that lookup fails or has different field names, use the message.
    const fromMsg = data?.subscription || {};
    let fresh = null;
    try { fresh = await getFungiesSubscription(subscriptionId); } catch { fresh = null; }
    const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== "");
    const rawStatus = String(pick(fresh?.status, fromMsg.status, "active")).toLowerCase(); // e.g. "active", "incomplete", "cancelled"
    const status = rawStatus === "incomplete" ? "past_due" : rawStatus === "canceled" ? "cancelled" : rawStatus;
    const endRaw = pick(fresh?.currentPeriodEnd, fresh?.currentIntervalEnd, fromMsg.currentPeriodEnd, fromMsg.currentIntervalEnd);
    let periodEnd = null;
    if (endRaw !== undefined) { const d = typeof endRaw === "number" ? new Date(endRaw > 1e12 ? endRaw : endRaw * 1000) : new Date(endRaw); if (!isNaN(d.getTime())) periodEnd = d.toISOString(); }
    const cancelAtEnd = !!pick(fresh?.cancelAtPeriodEnd, fresh?.cancelAtIntervalEnd, fromMsg.cancelAtPeriodEnd, fromMsg.cancelAtIntervalEnd, false);

    const { error: upErr } = await supabase.from("subscriptions").upsert({
      user_id: userId,
      plan_id: planId,
      status,
      provider: "fungies",
      fungies_subscription_id: subscriptionId,
      fungies_customer_id: fungiesCustomerId,
      current_period_end: periodEnd,
      cancel_at_period_end: cancelAtEnd,
      updated_at: new Date().toISOString(),
    });
    if (upErr) {
      // Say so loudly (Fungies shows this text in its delivery log, and retries) instead of pretending it worked.
      return NextResponse.json({ error: "Could not save subscription: " + upErr.message }, { status: 500 });
    }
    const { error: profErr } = await supabase.from("profiles").update({ is_premium: status === "active" }).eq("id", userId);
    if (profErr) return NextResponse.json({ error: "Could not update profile: " + profErr.message }, { status: 500 });
  } else if (
    eventType === "subscription_updated" ||
    eventType === "subscription_cancelled" ||
    eventType === "subscription_interval"
  ) {
    // These carry a subscription id but not our own user_id/plan_id —
    // match back to the row payment_success already created for this
    // subscription, rather than requiring custom fields on every
    // event type.
    const subscriptionId = data?.subscription?.id;
    if (!subscriptionId) {
      return NextResponse.json({ received: true });
    }

    const { data: existingRow } = await supabase
      .from("subscriptions")
      .select("user_id, plan_id")
      .eq("fungies_subscription_id", subscriptionId)
      .eq("provider", "fungies")
      .maybeSingle();

    if (!existingRow) {
      // Nothing on file yet for this subscription (e.g. this event
      // arrived before the first payment_success somehow) — nothing
      // to update. Acknowledge and move on.
      return NextResponse.json({ received: true });
    }

    const fromMsg = data?.subscription || {};
    let fresh = null;
    try { fresh = await getFungiesSubscription(subscriptionId); } catch { fresh = null; }
    const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== "");
    const rawStatus = String(pick(fresh?.status, fromMsg.status, "active")).toLowerCase();
    const status = rawStatus === "incomplete" ? "past_due" : rawStatus === "canceled" ? "cancelled" : rawStatus;
    const endRaw = pick(fresh?.currentPeriodEnd, fresh?.currentIntervalEnd, fromMsg.currentPeriodEnd, fromMsg.currentIntervalEnd);
    let periodEnd = null;
    if (endRaw !== undefined) { const d = typeof endRaw === "number" ? new Date(endRaw > 1e12 ? endRaw : endRaw * 1000) : new Date(endRaw); if (!isNaN(d.getTime())) periodEnd = d.toISOString(); }
    const cancelAtEnd = !!pick(fresh?.cancelAtPeriodEnd, fresh?.cancelAtIntervalEnd, fromMsg.cancelAtPeriodEnd, fromMsg.cancelAtIntervalEnd, false);

    const { error: updErr } = await supabase
      .from("subscriptions")
      .update({
        status,
        current_period_end: periodEnd,
        cancel_at_period_end: cancelAtEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("fungies_subscription_id", subscriptionId)
      .eq("provider", "fungies");
    if (updErr) return NextResponse.json({ error: "Could not update subscription: " + updErr.message }, { status: 500 });

    await supabase
      .from("profiles")
      .update({ is_premium: status === "active" })
      .eq("id", existingRow.user_id);
  }
  // subscription_created and any other event types are acknowledged
  // but not acted on — see the comments above for why.

  return NextResponse.json({ received: true });
}
