import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { hasAnySubscription } from "@/lib/access";
import { AVATARS } from "@/lib/avatars";
import { THEMES } from "@/lib/themes";
import { COSMETIC_BADGES } from "@/lib/cosmetics";

// Enforced here, not just hidden in the account page UI — anyone
// could otherwise call this route directly and set these fields
// without ever having paid for a subscription.
export async function PATCH(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin, bonus_subscription_until").eq("id", user.id).maybeSingle();
  // Admins get every premium perk without needing an actual paid
  // subscription — the same bypass already used for game access
  // elsewhere, extended here since this route was missing it.
  const admin = profile?.is_admin === true;
  if (!admin && !(await hasAnySubscription(supabase, user.id, profile))) {
    return NextResponse.json({ error: "An active subscription is needed for this." }, { status: 403 });
  }

  const body = await request.json();
  const updates = {};

  // null is a valid, explicit choice ("remove my avatar") — checked
  // for key presence rather than truthiness, same reasoning as the
  // countdown-clearing logic in the site-settings route.
  if ("avatar_id" in body) {
    if (body.avatar_id === null || AVATARS.some((a) => a.id === body.avatar_id)) updates.avatar_id = body.avatar_id;
  }
  if ("theme_id" in body) {
    if (body.theme_id === null || THEMES.some((t) => t.id === body.theme_id)) updates.theme_id = body.theme_id;
  }
  if ("cosmetic_badge" in body) {
    if (body.cosmetic_badge === null || COSMETIC_BADGES.some((b) => b.id === body.cosmetic_badge)) updates.cosmetic_badge = body.cosmetic_badge;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
