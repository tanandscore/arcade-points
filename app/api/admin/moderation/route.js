import { NextResponse } from "next/server";
import { requireAdmin, audit } from "@/lib/adminGuard";

// Find a player by username, see their scores, suspend them or remove a score.
export async function GET(request) {
  const c = await requireAdmin(); if (!c.ok) return c.response;
  const q = (new URL(request.url).searchParams.get("q") || "").trim().replace(/[%,()]/g, "").slice(0, 40);
  if (q.length < 2) return NextResponse.json({ players: [] });
  const { data: profiles, error } = await c.service.from("profiles").select("id, username, country, created_at, is_suspended, suspended_reason, is_admin").ilike("username", `%${q}%`).limit(8);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (profiles || []).map((p) => p.id);
  const { data: scores } = ids.length ? await c.service.from("scores").select("user_id, game, score, updated_at").in("user_id", ids) : { data: [] };
  return NextResponse.json({ players: (profiles || []).map((p) => ({ ...p, scores: (scores || []).filter((s) => s.user_id === p.id).sort((a, b) => b.score - a.score) })) });
}

export async function POST(request) {
  const c = await requireAdmin(); if (!c.ok) return c.response;
  const { userId, action, reason } = await request.json();
  if (!userId || !["suspend", "unsuspend"].includes(action)) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  if (userId === c.adminId) return NextResponse.json({ error: "You can't suspend yourself." }, { status: 400 });
  const suspend = action === "suspend";
  const { error } = await c.service.from("profiles").update({ is_suspended: suspend, suspended_reason: suspend ? String(reason || "").slice(0, 200) || null : null }).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit(c, suspend ? "player.suspend" : "player.unsuspend", userId, { reason: reason || null });
  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  const c = await requireAdmin(); if (!c.ok) return c.response;
  const { userId, game } = await request.json();
  if (!userId || !game) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const { data: old } = await c.service.from("scores").select("score").eq("user_id", userId).eq("game", game).maybeSingle();
  const { error } = await c.service.from("scores").delete().eq("user_id", userId).eq("game", game);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit(c, "score.delete", userId, { game, score: old?.score ?? null });
  return NextResponse.json({ success: true });
}
