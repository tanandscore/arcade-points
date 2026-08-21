import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { initialDuelState, attachSecondPlayer } from "@/lib/territoryDuel";

export async function POST(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { game_slug } = await request.json();
  const service = createServiceSupabase();

  // Look for someone else already waiting for an opponent.
  const { data: waiting } = await service
    .from("duels")
    .select("*")
    .eq("game_slug", game_slug)
    .eq("status", "waiting")
    .neq("player1_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (waiting) {
    const { data: updated } = await service
      .from("duels")
      .update({
        player2_id: user.id,
        status: "active",
        turn_user_id: waiting.player1_id,
        state: attachSecondPlayer(waiting.state, user.id),
        updated_at: new Date().toISOString(),
      })
      // .eq("status", "waiting") guards against two players joining
      // the same waiting duel at the exact same moment — if someone
      // else won that race, this update matches zero rows and we
      // fall through to creating a fresh duel instead.
      .eq("id", waiting.id)
      .eq("status", "waiting")
      .select()
      .single();

    if (updated) {
      return NextResponse.json({ duelId: updated.id });
    }
  }

  const { data: created, error: createError } = await service
    .from("duels")
    .insert({
      game_slug,
      player1_id: user.id,
      status: "waiting",
      state: initialDuelState(user.id),
    })
    .select()
    .single();

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  return NextResponse.json({ duelId: created.id });
}
