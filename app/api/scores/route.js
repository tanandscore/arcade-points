import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getGame } from "@/lib/games";
import { isAdmin } from "@/lib/admin";

export async function POST(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { game, score } = await request.json();
  const gameDef = await getGame(game);

  if (!gameDef || typeof score !== "number" || score < 0) {
    return NextResponse.json({ error: "Invalid score submission." }, { status: 400 });
  }

  const admin = await isAdmin(supabase, user.id);

  // Paid-game gate: confirm the user actually has access before accepting a
  // score — skipped entirely for admins, who play everything free.
  if (!admin && gameDef.accessType === "onetime") {
    const { data: purchase } = await supabase
      .from("purchases")
      .select("game")
      .eq("user_id", user.id)
      .eq("game", game)
      .maybeSingle();
    if (!purchase) {
      return NextResponse.json({ error: "This game hasn't been purchased." }, { status: 403 });
    }
  } else if (!admin && gameDef.accessType === "subscription") {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, plan_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (sub?.status !== "active" || sub?.plan_id !== gameDef.subscriptionPlanId) {
      return NextResponse.json({ error: "This game needs an active subscription to this tier." }, { status: 403 });
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

  // Lifetime points accumulate on EVERY finish, not just personal
  // bests — this is a separate, ever-growing counter that powers the
  // Hall of Fame, distinct from the per-game "best score" leaderboards.
  await supabase.rpc("increment_lifetime_points", { p_user_id: user.id, p_amount: score });

  // Detect whether this specific submission just pushed the player to
  // #1 — either for this one game, or overall (summed across every
  // game) — so the client can show a celebration. Only worth checking
  // when this submission actually changed their best; otherwise
  // nothing about their standing could have just changed.
  let becameNumberOneInGame = false;
  let becameNumberOneOverall = false;

  if (isNewBest) {
    const { count: higherInGame } = await supabase
      .from("scores")
      .select("user_id", { count: "exact", head: true })
      .eq("game", game)
      .gt("score", score);
    becameNumberOneInGame = (higherInGame || 0) === 0;

    const { data: allScores } = await supabase.from("scores").select("user_id, score");
    const totals = {};
    for (const row of allScores || []) {
      totals[row.user_id] = (totals[row.user_id] || 0) + row.score;
    }
    const myTotal = totals[user.id] || 0;
    becameNumberOneOverall = Object.entries(totals).every(([uid, total]) => uid === user.id || total < myTotal);
  }

  return NextResponse.json({
    isNewBest,
    best: Math.max(prevBest, score),
    becameNumberOneInGame,
    becameNumberOneOverall,
  });
}
