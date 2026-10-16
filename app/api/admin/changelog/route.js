import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import { getChangelogEntries } from "@/lib/changelog";

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return { ok: false, response: NextResponse.json({ error: "Admin access required." }, { status: 403 }), user: null, supabase: null };
  }
  return { ok: true, user, supabase };
}

export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  // Uses the service-role client, not the admin's own session — as
  // of migration_063 the public RLS policy only allows published
  // rows through, which would otherwise hide drafts from admins too
  // if their own session were used here. The same service-role
  // pattern this route already uses for POST/DELETE below.
  const service = createServiceSupabase();
  return NextResponse.json({ entries: await getChangelogEntries(service, 100) });
}

export async function POST(request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  const { title, body, game_slug, published } = await request.json();
  if (!title || !body) {
    return NextResponse.json({ error: "Title and body are required." }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { data, error } = await service
    .from("changelog_entries")
    .insert({
      title: title.trim().slice(0, 150),
      body: body.trim().slice(0, 2000),
      game_slug: (game_slug || "").trim() || null,
      // Defaults to draft (false) unless the caller explicitly asks
      // to publish immediately — the whole point of this feature is
      // letting an admin write something without it going live the
      // instant they hit save.
      published: published === true,
      created_by: check.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ entry: data });
}

export async function PATCH(request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  const { id, published } = await request.json();
  if (!id || typeof published !== "boolean") {
    return NextResponse.json({ error: "id and a boolean published value are required." }, { status: 400 });
  }
  const service = createServiceSupabase();
  const { data, error } = await service.from("changelog_entries").update({ published }).eq("id", id).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ entry: data });
}

export async function DELETE(request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }
  const service = createServiceSupabase();
  const { error } = await service.from("changelog_entries").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
