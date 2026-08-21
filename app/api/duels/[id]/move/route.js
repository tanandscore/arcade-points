import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { applyMove, checkWinner } from "@/lib/territoryDuel";

export async function POST(request, { params }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const action = await request.json();
  const service = createServiceSupabase();

  const { data: duel, error } = await service.from("duels").select("*").eq("id", id).single();
  if (error || !duel) {
    return NextResponse.json({ error: "Duel not found." }, { status: 404 });
  }
  if (duel.status !== "active") {
    return NextResponse.json({ error: "This duel isn't active." }, { status: 400 });
  }
  if (duel.turn_user_id !== user.id) {
    return NextResponse.json({ error: "It's not your turn." }, { status: 403 });
  }

  const opponentId = duel.player1_id === user.id ? duel.player2_id : duel.player1_id;
  const result = applyMove(duel.state, user.id, action);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const winner = checkWinner(result.state, duel.player1_id, duel.player2_id);
  const updates = {
    state: result.state,
    turn_user_id: opponentId,
    updated_at: new Date().toISOString(),
  };
  if (winner) {
    updates.status = "finished";
    updates.winner_id = winner === "draw" ? null : winner;
  }

  const { error: updateError } = await service.from("duels").update(updates).eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, finished: !!winner, winner: winner === "draw" ? "draw" : winner || null });
}
