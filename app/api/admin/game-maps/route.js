import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import { audit } from "@/lib/adminGuard";
import { GAME_MAPS } from "@/lib/gameMaps";

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) return { ok: false, response: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  return { ok: true, adminId: user.id, adminName: user.email };
}

export async function GET() {
  const check = await requireAdmin(); if (!check.ok) return check.response;
  const service = createServiceSupabase();
  const { data, error } = await service.from("game_maps").select("game_slug, map_id, enabled");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ switches: data || [] });
}

export async function PATCH(request) {
  const check = await requireAdmin(); if (!check.ok) return check.response;
  const { slug, mapId, enabled } = await request.json();
  const game = GAME_MAPS[slug];
  if (!game || !game.maps.some((m) => m.id === mapId) || typeof enabled !== "boolean") return NextResponse.json({ error: "Unknown game or map." }, { status: 400 });
  const service = createServiceSupabase();
  if (!enabled) { // never allow the last map of a game to be switched off
    const { data } = await service.from("game_maps").select("map_id").eq("game_slug", slug).eq("enabled", false);
    const offNow = new Set((data || []).map((r) => r.map_id)); offNow.add(mapId);
    if (game.maps.every((m) => offNow.has(m.id))) return NextResponse.json({ error: "At least one map must stay on. To hide the whole game use the GAMES panel on /admin." }, { status: 400 });
  }
  await audit({ service, adminId: check.adminId, adminName: check.adminName }, "map.switch", `${slug}/${mapId}`, { enabled });
  const { error } = await service.from("game_maps").upsert({ game_slug: slug, map_id: mapId, enabled, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
