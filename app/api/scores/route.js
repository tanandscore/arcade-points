import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getGame } from "@/lib/games";

export async function POST(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { game, score } = await request.json();
  const gameDef = getGame(game);

  if (!gameDef || typeof score !== "number" || score < 0) {
    return NextResponse.json({ error: "Invalid score submission." }, { status: 400 });
  }

  // Paid-game gate: only accept a score if the user has purchased this game
  if (!gameDef.free) {
    const { data: purchase } = await supabase
      .from("purchases")
      .select("game")
      .eq("user_id", user.id)
      .eq("game", game)
      .maybeSingle();
    if (!purchase) {
      return NextResponse.json({ error: "This game hasn't been purchased." }, { status: 403 });
    }
  }

  const { data: existing } = await supabase
    .from("scores")
    .select("score")
    .eq("user_id", user.id)
    .eq("game", game)
    .maybeSingle();

  const prevBest = existing?.score || 0;
  const isNewBest = score > prevBest;

  if (isNewBest) {
    const { error } = await supabase
      .from("scores")
      .upsert({ user_id: user.id, game, score, updated_at: new Date().toISOString() });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ isNewBest, best: Math.max(prevBest, score) });
}
