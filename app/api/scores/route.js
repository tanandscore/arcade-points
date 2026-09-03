import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getGame } from "@/lib/games";
import { isAdmin } from "@/lib/admin";
import { hasSubscriptionAccess } from "@/lib/access";
import { recordActivityAndCheckAchievements } from "@/lib/achievements";
import { XP_PER_SESSION, XP_PER_NEW_BEST } from "@/lib/xp";
import { logActivityEvents } from "@/lib/activity";
import { evaluateAndAwardDailyChallenges } from "@/lib/challenges";
import { awardXp } from "@/lib/seasons";

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
    const { data: profile } = await supabase
      .from("profiles")
      .select("bonus_subscription_until")
      .eq("id", user.id)
      .maybeSingle();
    const hasAccess = await hasSubscriptionAccess(supabase, user.id, gameDef.subscriptionPlanId, profile);
    if (!hasAccess) {
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

  const newlyUnlockedAchievements = await recordActivityAndCheckAchievements(supabase, user.id);

  // XP is a flat award for playing at all, plus a bonus for beating
  // your own record, plus whatever the newly-unlocked achievements
  // are worth — all summed into one atomic increment rather than
  // several separate writes.
  let xpGained = XP_PER_SESSION + (isNewBest ? XP_PER_NEW_BEST : 0);
  if (newlyUnlockedAchievements.length > 0) {
    const { data: unlockedDefs } = await supabase
      .from("achievements")
      .select("xp_value")
      .in("id", newlyUnlockedAchievements);
    xpGained += (unlockedDefs || []).reduce((sum, a) => sum + (a.xp_value || 0), 0);
  }
  await awardXp(supabase, user.id, xpGained);

  // Continue Playing/Trending's data source — updated on EVERY
  // submission regardless of whether it was a new best, unlike
  // scores.updated_at.
  await supabase.from("last_played").upsert({ user_id: user.id, game, played_at: new Date().toISOString() });

  await logActivityEvents(supabase, user.id, {
    xpGained,
    newlyUnlockedAchievements,
    primaryEvent: isNewBest ? { event_type: "new_best", game, meta: { score } } : null,
  });

  // Runs after last_played and activity_events are already written
  // for this request, since "played 3 games" and "beat a personal
  // best" both need to read those same-request writes back.
  const { newlyCompleted: newlyCompletedChallenges, xpFromChallenges } = await evaluateAndAwardDailyChallenges(supabase, user.id);
  if (xpFromChallenges > 0) {
    await awardXp(supabase, user.id, xpFromChallenges);
  }

  return NextResponse.json({
    isNewBest,
    best: Math.max(prevBest, score),
    becameNumberOneInGame,
    becameNumberOneOverall,
    newlyUnlockedAchievements,
    xpGained: xpGained + xpFromChallenges,
    newlyCompletedChallenges,
  });
}
