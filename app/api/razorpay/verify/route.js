import crypto from "crypto";
import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { razorpay } from "@/lib/razorpay";

export async function POST(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }

  // 1. Cryptographically confirm this payment really came from Razorpay.
  // Only someone holding the secret key (i.e. our server) could produce
  // a matching signature, so this can't be faked from the browser.
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
  }

  // 2. Confirm this order was created for the person currently logged in,
  // so one user can't reuse another user's payment confirmation.
  const order = await razorpay.orders.fetch(razorpay_order_id);
  if (order.notes?.user_id !== user.id) {
    return NextResponse.json({ error: "This payment doesn't belong to your account." }, { status: 403 });
  }

  const game = order.notes?.game || "math";

  // 3. Grant access using the service role, which bypasses RLS —
  // this is the only path that's allowed to write to purchases.
  const serviceSupabase = createServiceSupabase();
  const { error } = await serviceSupabase.from("purchases").upsert({ user_id: user.id, game });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, game });
}
