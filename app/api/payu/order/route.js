import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { getGame } from "@/lib/games";
import { getPayuCredentials, getPayuCheckoutUrl, generateTxnId, generatePaymentHash } from "@/lib/payu";

const DAY_PASS_RUPEES = "10.00"; // ₹10 — PayU amounts are decimal rupee strings, not paise like Razorpay

// Returns everything the client needs to build and submit a real
// form POST to PayU's hosted checkout — PayU's flow is a full-page
// redirect to a PayU-hosted payment page, not a JS popup modal like
// Razorpay, so there's no SDK to load here.
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
  const { type, game, phone } = await request.json();

  // PayU requires a phone on every request. This site has never
  // collected one — if the profile doesn't have one on file yet, the
  // client is expected to have prompted for it and sent it here;
  // save it for next time rather than asking again every purchase.
  let phoneToUse = profile?.phone;
  if (!phoneToUse) {
    if (typeof phone !== "string" || !/^[0-9]{10}$/.test(phone.trim())) {
      return NextResponse.json({ error: "phone_required", message: "Enter a 10-digit phone number to continue." }, { status: 400 });
    }
    phoneToUse = phone.trim();
    const service = createServiceSupabase();
    await service.from("profiles").update({ phone: phoneToUse }).eq("id", user.id);
  }

  let amount, productinfo, udf1, udf2;
  if (type === "daypass") {
    amount = DAY_PASS_RUPEES;
    productinfo = "Tap & Score 24-Hour Pass";
    udf1 = "daypass";
    udf2 = "";
  } else {
    const gameDef = await getGame(game);
    if (!gameDef || gameDef.accessType !== "onetime") {
      return NextResponse.json({ error: "This game isn't a one-time purchase." }, { status: 400 });
    }
    amount = (gameDef.pricePaise / 100).toFixed(2);
    productinfo = `Tap & Score — ${gameDef.name}`;
    udf1 = "onetime";
    udf2 = gameDef.slug;
  }
  // Encoded explicitly rather than relying on the browser's session
  // cookie still being valid after the redirect out to PayU's domain
  // and back — same reasoning as Razorpay's notes.user_id.
  const udf3 = user.id;

  const txnid = generateTxnId("ONETIME");
  const firstname = profile?.username || "player";
  const email = user.email;

  const hash = generatePaymentHash({ key, txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, salt });

  const origin = new URL(request.url).origin;

  return NextResponse.json({
    checkoutUrl: getPayuCheckoutUrl(),
    fields: {
      key,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone: phoneToUse,
      surl: `${origin}/api/payu/success`,
      furl: `${origin}/api/payu/failure`,
      udf1,
      udf2,
      udf3,
      hash,
    },
  });
}
