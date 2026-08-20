import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getRazorpay } from "@/lib/razorpay";
import { getGame } from "@/lib/games";

export async function POST(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { game } = await request.json();
  const gameDef = getGame(game);

  if (!gameDef || gameDef.free) {
    return NextResponse.json({ error: "This game isn't purchasable." }, { status: 400 });
  }

  const order = await getRazorpay().orders.create({
    amount: gameDef.pricePaise,
    currency: "INR",
    // notes travel with the order so /api/razorpay/verify can confirm
    // the payment belongs to the same user who requested it
    notes: { user_id: user.id, game: gameDef.slug },
  });

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
}
