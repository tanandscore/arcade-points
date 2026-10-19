import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import { audit } from "@/lib/adminGuard";

// Create many tournaments in one go (the Season Planner). Each item has the same fields as a single tournament.
export async function POST(request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { items } = await request.json();
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: "Nothing to create." }, { status: 400 });
  if (items.length > 60) return NextResponse.json({ error: "Up to 60 tournaments at a time." }, { status: 400 });

  const rows = [];
  for (const [n, it] of items.entries()) {
    const s = new Date(it.starts_at), e = new Date(it.ends_at);
    if (!it.name || isNaN(s) || isNaN(e) || e <= s) return NextResponse.json({ error: `Tournament ${n + 1} has a missing name or bad dates.` }, { status: 400 });
    if (!Array.isArray(it.game_slugs) || it.game_slugs.length === 0) return NextResponse.json({ error: `Tournament ${n + 1} has no games.` }, { status: 400 });
    rows.push({
      name: String(it.name).trim().slice(0, 120),
      description: String(it.description || "").trim().slice(0, 1000) || null,
      starts_at: s.toISOString(), ends_at: e.toISOString(),
      game_slugs: it.game_slugs.map(String),
      announcement: String(it.announcement || "").trim().slice(0, 1000) || null,
      require_tournament_entry: it.require_tournament_entry === true,
      created_by: user.id,
    });
  }
  const service = createServiceSupabase();
  const { data, error } = await service.from("tournaments").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit({ service, adminId: user.id, adminName: user.email }, "tournament.bulk", `${rows.length} tournaments`, { first: rows[0].starts_at, last: rows[rows.length - 1].ends_at });
  return NextResponse.json({ created: (data || []).length });
}
