import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";

// IMPORTANT SCOPE NOTE, read before relying on this in production:
// this marks the subscription to stop renewing on the SITE'S side
// (cancel_at_period_end = true) — the same promise the UI already
// makes ("you keep access until the period ends, then nothing more
// is charged"). What this does NOT yet do is call PayU to actually
// stop the recurring mandate on their end.
//
// PayU's docs describe a "cancel_transaction" S2S API
// (sha512(key|cancel_transaction|mihpayid|salt)) that plausibly
// covers this, but nothing in what's verified here confirms that
// command is the correct one for stopping an ongoing SI mandate
// specifically, as opposed to reversing a single transaction. Rather
// than guess at a billing-critical API call, this is left undone.
// Until it's built and sandbox-tested: if a user cancels here, also
// cancel the mandate manually from the PayU merchant dashboard, or
// they may still be charged next cycle despite the site showing
// "cancelled." subscriptions.payu_mihpayid is already being stored
// (see app/api/payu/success/route.js) specifically so that work is
// ready to build once verified.
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
    .select("status, current_period_end, cancel_at_period_end")
    .eq("user_id", user.id)
    .eq("plan_id", planId)
    .maybeSingle();

  if (!sub || sub.status !== "active") {
    return NextResponse.json({ error: "You don't have an active subscription to cancel." }, { status: 400 });
  }
  if (sub.cancel_at_period_end) {
    return NextResponse.json({ error: "Your subscription is already set to cancel." }, { status: 400 });
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
