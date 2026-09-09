import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { checkDuelAchievements } from "@/lib/achievements";
import { XP_PER_DUEL_WIN } from "@/lib/xp";
import { logActivityEvents } from "@/lib/activity";
import { awardXp } from "@/lib/seasons";

// A player can only claim this if it is genuinely NOT their turn (so
// they can't just abandon their own turn and claim a win) AND enough
// real time has passed since the last move that the opponent is
// reasonably considered gone, not just thinking.
const INACTIVITY_MS = 60 * 1000;

export async function POST(request, { params }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const service = createServiceSupabase();
  const { data: duel, error } = await service.from("duels").select("*").eq("id", id).single();

  if (error || !duel) {
    return NextResponse.json({ error: "Duel not found." }, { status: 404 });
  }
  if (duel.status !== "active") {
    return NextResponse.json({ error: "This duel isn't active." }, { status: 400 });
  }
  const isParticipant = duel.player1_id === user.id || duel.player2_id === user.id;
  if (!isParticipant) {
    return NextResponse.json({ error: "You're not in this duel." }, { status: 403 });
  }
  if (duel.turn_user_id === user.id) {
    return NextResponse.json({ error: "It's your turn — you can't claim inactivity." }, { status: 400 });
  }

  const elapsedMs = Date.now() - new Date(duel.updated_at).getTime();
  if (elapsedMs < INACTIVITY_MS) {
    const remaining = Math.ceil((INACTIVITY_MS - elapsedMs) / 1000);
    return NextResponse.json({ error: `Wait ${remaining}s more before claiming.` }, { status: 400 });
  }

  const { error: updateError } = await service
    .from("duels")
    .update({ status: "finished", winner_id: user.id, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "active"); // guards against the opponent moving right as this fires

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const newlyUnlockedAchievements = await checkDuelAchievements(supabase, user.id);

  let xpGained = XP_PER_DUEL_WIN;
  if (newlyUnlockedAchievements.length > 0) {
    const { data: unlockedDefs } = await supabase.from("achievements").select("xp_value").in("id", newlyUnlockedAchievements);
    xpGained += (unlockedDefs || []).reduce((sum, a) => sum + (a.xp_value || 0), 0);
  }
  await awardXp(supabase, user.id, xpGained);

  await logActivityEvents(supabase, user.id, {
    xpGained,
    newlyUnlockedAchievements,
    primaryEvent: { event_type: "duel_win", game: duel.game_slug || null, meta: {} },
  });

  return NextResponse.json({ success: true, newlyUnlockedAchievements, xpGained });
}
