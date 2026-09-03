import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getGame } from "@/lib/games";
import { isAdmin } from "@/lib/admin";
import { hasSubscriptionAccess, hasAnySubscription } from "@/lib/access";
import { recordActivityAndCheckAchievements } from "@/lib/achievements";

async function checkAccess(supabase, user, gameDef) {
  const admin = await isAdmin(supabase, user.id);
  if (admin) return true;
  if (gameDef.accessType !== "subscription") return true;
  const { data: profile } = await supabase.from("profiles").select("bonus_subscription_until").eq("id", user.id).maybeSingle();
  return hasSubscriptionAccess(supabase, user.id, gameDef.subscriptionPlanId, profile);
}

// Returns the current user's best score at every difficulty they've
// played, for one game — used to show "your best: 340" next to each
// tier on the difficulty-select screen.
export async function GET(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const game = new URL(request.url).searchParams.get("game");
  if (!game) return NextResponse.json({ error: "Missing game." }, { status: 400 });

  const { data, error } = await supabase
    .from("difficulty_scores")
    .select("difficulty, score")
    .eq("user_id", user.id)
    .eq("game", game);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const byDifficulty = {};
  for (const row of data || []) byDifficulty[row.difficulty] = row.score;
  return NextResponse.json({ bests: byDifficulty });
}

export async function POST(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { game, difficulty, score } = await request.json();
  const gameDef = await getGame(game);
  if (!gameDef || !difficulty || typeof score !== "number" || score < 0) {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  if (!(await checkAccess(supabase, user, gameDef))) {
    return NextResponse.json({ error: "This game needs an active subscription to this tier." }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("difficulty_scores")
    .select("score")
    .eq("user_id", user.id)
    .eq("game", game)
    .eq("difficulty", difficulty)
    .maybeSingle();

  const prevBest = existing?.score || 0;
  const isNewBest = score > prevBest;

  if (isNewBest) {
    const { error } = await supabase
      .from("difficulty_scores")
      .upsert({ user_id: user.id, game, difficulty, score, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Tournament-scoped best, tracked independently of the all-time
  // best above — see migration_056 for why this can't just reuse
  // difficulty_scores (it has no per-session history, so a player
  // whose all-time best predates the tournament would never show up
  // on its leaderboard even while actively playing in it). Every
  // submission is checked, not just new all-time bests, since a
  // score can be a new TOURNAMENT best without being a new ALL-TIME
  // best.
  //
  // "Tournament Access" is a subscriber-only perk — gated here, at
  // the point scores actually get written, not just hidden on the
  // tournament page. A non-subscriber's game session still counts
  // toward their normal best score as usual; it just never reaches
  // the tournament leaderboard.
  const { data: perkProfile } = await supabase.from("profiles").select("bonus_subscription_until").eq("id", user.id).maybeSingle();
  // A small extra admin check, not a reuse of checkAccess()'s result
  // above — that returns a combined true/false for "has access
  // either way," not the admin flag on its own.
  const isSubscriber = (await isAdmin(supabase, user.id)) || (await hasAnySubscription(supabase, user.id, perkProfile));

  const nowIso = new Date().toISOString();
  const { data: activeTournaments } = isSubscriber
    ? await supabase
        .from("tournaments")
        .select("id")
        .contains("game_slugs", [game])
        .lte("starts_at", nowIso)
        .gte("ends_at", nowIso)
    : { data: [] };
  for (const t of activeTournaments || []) {
    const { data: existingTournamentScore } = await supabase
      .from("tournament_scores")
      .select("best_score")
      .eq("tournament_id", t.id)
      .eq("user_id", user.id)
      .eq("game", game)
      .maybeSingle();
    if (score > (existingTournamentScore?.best_score || 0)) {
      await supabase.from("tournament_scores").upsert({ tournament_id: t.id, user_id: user.id, game, best_score: score, achieved_at: nowIso });
    }
  }

  return NextResponse.json({
    isNewBest,
    best: Math.max(prevBest, score),
    newlyUnlockedAchievements: await recordActivityAndCheckAchievements(supabase, user.id),
  });
}
