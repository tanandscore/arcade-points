import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getRazorpay } from "@/lib/razorpay";

const DAY_PASS_PAISE = 1000; // ₹10

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const order = await getRazorpay().orders.create({
    amount: DAY_PASS_PAISE,
    currency: "INR",
    // type: "daypass" is what /api/razorpay/verify checks to grant 24
    // hours of Premium access instead of unlocking a specific game.
    notes: { user_id: user.id, type: "daypass" },
  });

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
}
