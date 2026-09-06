import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import { getTournaments } from "@/lib/tournaments";

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return { ok: false, response: NextResponse.json({ error: "Admin access required." }, { status: 403 }), user: null };
  }
  return { ok: true, user };
}

export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  return NextResponse.json({ tournaments: await getTournaments() });
}

export async function POST(request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  const { name, description, starts_at, ends_at, game_slugs, announcement, require_tournament_entry } = await request.json();
  if (!name || !starts_at || !ends_at) {
    return NextResponse.json({ error: "Name, start time, and end time are required." }, { status: 400 });
  }
  if (new Date(ends_at) <= new Date(starts_at)) {
    return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { data, error } = await service
    .from("tournaments")
    .insert({
      name: name.trim().slice(0, 120),
      description: (description || "").trim().slice(0, 1000) || null,
      starts_at: new Date(starts_at).toISOString(),
      ends_at: new Date(ends_at).toISOString(),
      game_slugs: Array.isArray(game_slugs) ? game_slugs : [],
      announcement: (announcement || "").trim().slice(0, 1000) || null,
      require_tournament_entry: require_tournament_entry === true,
      created_by: check.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tournament: data });
}
