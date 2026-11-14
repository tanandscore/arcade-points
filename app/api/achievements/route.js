import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";

export async function GET(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const service = createServiceSupabase();

  // An achievement page for another user (a public profile) asks by
  // username. Achievement unlocks are meant to be publicly showable —
  // unlike raw scores or purchases — so this deliberately uses the
  // service client to read a target user's unlocks, bypassing the
  // "own rows only" RLS policy on user_achievements. Still requires
  // the caller to be logged in; it just isn't restricted to their
  // own achievements.
  const targetUsername = new URL(request.url).searchParams.get("username");
  let targetUserId = user.id;
  if (targetUsername) {
    const { data: targetProfile } = await service.from("profiles").select("id").eq("username", targetUsername).maybeSingle();
    if (!targetProfile) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    targetUserId = targetProfile.id;
  }
  const unlockedClient = targetUsername ? service : supabase;

  const [{ data: definitions }, { data: unlocked }, { count: totalUsers }, { data: allUnlocks }] = await Promise.all([
    supabase.from("achievements").select("*").order("sort_order"),
    unlockedClient.from("user_achievements").select("achievement_id, unlocked_at").eq("user_id", targetUserId),
    service.from("profiles").select("id", { count: "exact", head: true }),
    // Global completion % needs counts across every user, not just
    // this one — definitions are publicly readable, but per-achievement
    // unlock counts need every user's rows, which the caller's own
    // RLS-scoped client can't see. The service client here only ever
    // aggregates counts, never exposes which other specific user
    // unlocked what.
    service.from("user_achievements").select("achievement_id"),
  ]);

  const unlockedMap = {};
  for (const row of unlocked || []) unlockedMap[row.achievement_id] = row.unlocked_at;

  const completionCounts = {};
  for (const row of allUnlocks || []) {
    completionCounts[row.achievement_id] = (completionCounts[row.achievement_id] || 0) + 1;
  }

  const denominator = Math.max(1, totalUsers || 1);
  const achievements = (definitions || []).map((def) => ({
    ...def,
    unlockedAt: unlockedMap[def.id] || null,
    globalCompletionPct: Math.round(((completionCounts[def.id] || 0) / denominator) * 1000) / 10,
  }));

  return NextResponse.json({ achievements });
}
