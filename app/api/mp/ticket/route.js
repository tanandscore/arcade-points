import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import { signTicket } from "@/lib/mpTicket";

// Operation Blacksite multiplayer: "may I play online, and here is my pass".
// Multiplayer is shown as "coming soon" to everyone; only admins get a ticket for now. The ticket (signed with the server-only service key,
// valid for 10 minutes) is what the room server checks before letting anyone in — see lib/mpTicket.js and blacksite/server/room.js.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ signedIn: false, admin: false, comingSoon: true });
  const admin = await isAdmin(supabase, user.id);
  if (!admin) return NextResponse.json({ signedIn: true, admin: false, comingSoon: true });
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
  const name = (profile?.username || (user.email || "Admin").split("@")[0]).slice(0, 18);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ signedIn: true, admin: true, comingSoon: true, error: "Multiplayer is not configured on this server." });
  const ticket = await signTicket({ uid: user.id, name, admin: true }, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return NextResponse.json({ signedIn: true, admin: true, comingSoon: true, name, ticket }, { headers: { "Cache-Control": "no-store" } });
}
