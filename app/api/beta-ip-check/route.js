import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";

// Called by the signup form right after a successful signup. Reads
// CF-Connecting-IP, which Cloudflare sets at their edge and
// overwrites on any client-supplied value — this is genuinely not
// spoofable by the browser, unlike trusting a header the client sent
// directly. See migration_052 for the honest scope note on what this
// can and can't prevent.
export async function POST(request) {
  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }

  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip) {
    // No reliable IP available (e.g. local dev without Cloudflare in
    // front) — fail open rather than block a real signup over it.
    return NextResponse.json({ revoked: false });
  }

  const service = createServiceSupabase();

  const { data: profile } = await service.from("profiles").select("bonus_subscription_until").eq("id", userId).maybeSingle();
  const hasBonus = profile?.bonus_subscription_until && new Date(profile.bonus_subscription_until) > new Date();
  if (!hasBonus) {
    // Nothing to protect — this account didn't get a beta grant
    // (program was off, or slots were already full).
    return NextResponse.json({ revoked: false });
  }

  const { data: existingClaim } = await service.from("beta_ip_claims").select("user_id").eq("ip_address", ip).maybeSingle();

  if (existingClaim && existingClaim.user_id !== userId) {
    // Same IP already claimed a beta slot under a different account
    // — revoke this one's bonus and return the slot to the pool.
    await service.from("profiles").update({ bonus_subscription_until: null }).eq("id", userId);
    await service.rpc("release_beta_slot");
    return NextResponse.json({ revoked: true });
  }

  // First claim from this IP — record it so a future duplicate is caught.
  await service.from("beta_ip_claims").upsert({ ip_address: ip, user_id: userId });
  return NextResponse.json({ revoked: false });
}
