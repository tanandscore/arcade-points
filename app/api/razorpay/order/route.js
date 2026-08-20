import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { razorpay, MATH_PRICE_PAISE } from "@/lib/razorpay";

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const order = await razorpay.orders.create({
    amount: MATH_PRICE_PAISE,
    currency: "INR",
    // notes travel with the order so /api/razorpay/verify can confirm
    // the payment belongs to the same user who requested it
    notes: { user_id: user.id, game: "math" },
  });

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
}
