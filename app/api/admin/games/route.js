import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return { ok: false, response: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }
  return { ok: true };
}

// Deliberately reads every game regardless of is_active/admin_test_only
// — this is the one place in the app that needs to see the whole
// catalog, not just what's currently public.
export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  const service = createServiceSupabase();
  const { data, error } = await service
    .from("games")
    .select("slug, name, icon, category, is_active, admin_test_only, under_maintenance, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ games: data || [] });
}

export async function PATCH(request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  const { slug, is_active, admin_test_only, under_maintenance } = await request.json();
  if (!slug) {
    return NextResponse.json({ error: "Missing slug." }, { status: 400 });
  }

  const updates = {};
  if (typeof is_active === "boolean") updates.is_active = is_active;
  if (typeof admin_test_only === "boolean") updates.admin_test_only = admin_test_only;
  if (typeof under_maintenance === "boolean") updates.under_maintenance = under_maintenance;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { data, error } = await service.from("games").update(updates).eq("slug", slug).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ game: data });
}
