import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import { signTicket } from "@/lib/mpTicket";

// Operation Blacksite multiplayer: "may I play online, and here is my pass".
// Admin switch (site_settings.blacksite_mp_open): OFF = "coming soon" for everyone, admins can still test; ON = every signed-in player gets a pass.
// The ticket (signed with the server-only service key, valid for 10 minutes) is what the room server checks before letting anyone in
// - see lib/mpTicket.js and blacksite/server/room.js. The room server also refuses non-admins when the ticket says the switch was off.
export const dynamic = "force-dynamic";

async function switchIsOn() {
  try {
    const { data } = await createServiceSupabase().from("site_settings").select("blacksite_mp_open").eq("id", 1).maybeSingle();
    return !!(data && data.blacksite_mp_open);
  } catch { return false; }
}

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const open = await switchIsOn();
  if (!user) return NextResponse.json({ signedIn: false, admin: false, open, canPlay: false, comingSoon: !open });
  const admin = await isAdmin(supabase, user.id);
  if (!admin && !open) return NextResponse.json({ signedIn: true, admin: false, open, canPlay: false, comingSoon: true });
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
  const name = (profile?.username || (user.email || "Player").split("@")[0]).slice(0, 18);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ signedIn: true, admin, open, canPlay: false, comingSoon: !open, error: "Multiplayer is not configured on this server." });
  const ticket = await signTicket({ uid: user.id, name, admin, open }, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return NextResponse.json({ signedIn: true, admin, open, canPlay: true, comingSoon: !open, name, ticket }, { headers: { "Cache-Control": "no-store" } });
}
