import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { initialDuelState, attachSecondPlayer } from "@/lib/territoryDuel";

// Not every duel-based game needs the territory-specific board setup —
// racing duels, for instance, don't have "owner"/"troops" at all, they
// just need two players paired up. This keeps matchmaking reusable
// for future multiplayer games without new tables each time.
function buildInitialState(gameSlug, userId) {
  if (gameSlug === "territoryduel") return initialDuelState(userId);
  return {};
}

function attachOpponent(gameSlug, state, opponentId) {
  if (gameSlug === "territoryduel") return attachSecondPlayer(state, opponentId);
  return state;
}

// Waiting duels older than this are treated as abandoned (the creator
// likely left without cancelling) and skipped when matching, so a new
// player never gets paired into a "ghost" opponent who's already gone.
const STALE_WAITING_MS = 5 * 60 * 1000;

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
  const staleCutoff = new Date(Date.now() - STALE_WAITING_MS).toISOString();

  // Look for someone else already waiting for an opponent.
  const { data: waiting } = await service
    .from("duels")
    .select("*")
    .eq("game_slug", game_slug)
    .eq("status", "waiting")
    .neq("player1_id", user.id)
    .gte("created_at", staleCutoff)
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
        state: attachOpponent(game_slug, waiting.state, user.id),
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
      state: buildInitialState(game_slug, user.id),
    })
    .select()
    .single();

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  return NextResponse.json({ duelId: created.id });
}
