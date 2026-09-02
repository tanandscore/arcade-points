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

export async function PATCH(request, { params }) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  const { id } = await params;

  const body = await request.json();
  const updates = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim().slice(0, 120);
  if (typeof body.description === "string") updates.description = body.description.trim().slice(0, 1000) || null;
  if (typeof body.starts_at === "string" && !isNaN(new Date(body.starts_at).getTime())) updates.starts_at = new Date(body.starts_at).toISOString();
  if (typeof body.ends_at === "string" && !isNaN(new Date(body.ends_at).getTime())) updates.ends_at = new Date(body.ends_at).toISOString();
  if (Array.isArray(body.game_slugs)) updates.game_slugs = body.game_slugs;
  // Empty string clears the announcement, which is a real,
  // meaningful action (taking a banner down) — different from the
  // field being absent from the request entirely.
  if (typeof body.announcement === "string") updates.announcement = body.announcement.trim().slice(0, 1000) || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }
  if (updates.starts_at && updates.ends_at && new Date(updates.ends_at) <= new Date(updates.starts_at)) {
    return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { data, error } = await service.from("tournaments").update(updates).eq("id", id).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tournament: data });
}

export async function DELETE(request, { params }) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  const { id } = await params;

  const service = createServiceSupabase();
  const { error } = await service.from("tournaments").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
