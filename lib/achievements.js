import { getGames } from "@/lib/games";
import { HALL_OF_FAME_THRESHOLD } from "@/lib/leaderboard";

// Every criterion here reads real, already-existing data — scores,
// difficulty_scores, profiles.lifetime_points, duels, activity_days.
// Nothing is fabricated or simulated. This runs server-side, hooked
// into the existing score/difficulty-score/duel-win routes, so no
// individual game file ever needs to change to support a new
// achievement.

async function distinctGamesPlayed(supabase, userId) {
  const { data } = await supabase.from("scores").select("game").eq("user_id", userId);
  return new Set((data || []).map((r) => r.game));
}

async function lifetimePoints(supabase, userId) {
  const { data } = await supabase.from("profiles").select("lifetime_points").eq("id", userId).maybeSingle();
  return data?.lifetime_points || 0;
}

async function duelWins(supabase, userId) {
  const { count } = await supabase
    .from("duels")
    .select("id", { count: "exact", head: true })
    .eq("winner_id", userId)
    .eq("status", "finished");
  return count || 0;
}

export async function currentStreakDays(supabase, userId) {
  const { data } = await supabase
    .from("activity_days")
    .select("activity_date")
    .eq("user_id", userId)
    .order("activity_date", { ascending: false })
    .limit(400);
  if (!data || data.length === 0) return 0;

  let streak = 1;
  let cursor = new Date(data[0].activity_date);
  for (let i = 1; i < data.length; i++) {
    const prev = new Date(data[i].activity_date);
    const diffDays = Math.round((cursor - prev) / 86400000);
    if (diffDays === 1) {
      streak += 1;
      cursor = prev;
    } else if (diffDays === 0) {
      continue;
    } else {
      break;
    }
  }
  const mostRecent = new Date(data[0].activity_date);
  const daysSinceLast = Math.round((new Date().setHours(0, 0, 0, 0) - mostRecent.setHours(0, 0, 0, 0)) / 86400000);
  if (daysSinceLast > 1) return 0;
  return streak;
}

async function categoryCompletion(supabase, userId, category) {
  const games = await getGames();
  const inCategory = games.filter((g) => g.category === category);
  if (inCategory.length === 0) return { played: 0, total: 0 };
  const played = await distinctGamesPlayed(supabase, userId);
  const playedInCategory = inCategory.filter((g) => played.has(g.slug)).length;
  return { played: playedInCategory, total: inCategory.length };
}

async function hasAnyDifficultyScore(supabase, userId) {
  const { count } = await supabase
    .from("difficulty_scores")
    .select("game", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count || 0) > 0;
}

const CRITERIA = {
  first_steps: (ctx) => ctx.gamesPlayed.size >= 1,
  ten_games: (ctx) => ctx.gamesPlayed.size >= 10,
  arcade_regular: (ctx) => ctx.gamesPlayed.size >= 25,
  every_arcade_game: async (ctx) => {
    const c = await categoryCompletion(ctx.supabase, ctx.userId, "Arcade");
    return c.total > 0 && c.played >= c.total;
  },
  legends_path: async (ctx) => {
    const c = await categoryCompletion(ctx.supabase, ctx.userId, "Legend Pass");
    return c.total > 0 && c.played >= c.total;
  },
  power_player: async (ctx) => {
    const c = await categoryCompletion(ctx.supabase, ctx.userId, "Power Pass");
    return c.total > 0 && c.played >= c.total;
  },
  rising_star: (ctx) => ctx.lifetimePoints >= 10000,
  six_figures: (ctx) => ctx.lifetimePoints >= 100000,
  seven_figures: (ctx) => ctx.lifetimePoints >= 1000000,
  hall_of_fame: (ctx) => ctx.lifetimePoints >= HALL_OF_FAME_THRESHOLD,
  first_duel_won: (ctx) => ctx.duelWins >= 1,
  duelist: (ctx) => ctx.duelWins >= 10,
  duel_master: (ctx) => ctx.duelWins >= 50,
  on_a_roll: (ctx) => ctx.streakDays >= 3,
  devoted: (ctx) => ctx.streakDays >= 30,
  difficulty_seeker: (ctx) => ctx.hasDifficultyScore,
};

// Records today's activity day (idempotent — safe on every score
// submission) and evaluates every not-yet-unlocked achievement for
// this user. Returns the achievements newly unlocked THIS call, so
// the caller can show a celebration for exactly what just happened.
export async function recordActivityAndCheckAchievements(supabase, userId) {
  const today = new Date().toISOString().slice(0, 10);
  await supabase.from("activity_days").upsert({ user_id: userId, activity_date: today }, { onConflict: "user_id,activity_date", ignoreDuplicates: true });

  const [{ data: already }, gamesPlayed, points, wins, streakDays, hasDifficultyScore] = await Promise.all([
    supabase.from("user_achievements").select("achievement_id").eq("user_id", userId),
    distinctGamesPlayed(supabase, userId),
    lifetimePoints(supabase, userId),
    duelWins(supabase, userId),
    currentStreakDays(supabase, userId),
    hasAnyDifficultyScore(supabase, userId),
  ]);

  const alreadyUnlocked = new Set((already || []).map((r) => r.achievement_id));
  const ctx = { supabase, userId, gamesPlayed, lifetimePoints: points, duelWins: wins, streakDays, hasDifficultyScore };

  // Persist the peak streak once it's exceeded — the live streakDays
  // value above only reflects the CURRENT streak, which resets to 0
  // once broken. Without this, a past 45-day streak would leave no
  // trace once the player takes a day off. Uses the same
  // SECURITY DEFINER RPC pattern as XP/lifetime points, since
  // profiles has no direct UPDATE policy for regular users.
  if (streakDays > 0) {
    await supabase.rpc("update_longest_streak", { p_user_id: userId, p_streak: streakDays });
  }

  const newlyUnlocked = [];
  for (const [id, check] of Object.entries(CRITERIA)) {
    if (alreadyUnlocked.has(id)) continue;
    const passed = await check(ctx);
    if (!passed) continue;
    const { error } = await supabase.from("user_achievements").insert({ user_id: userId, achievement_id: id });
    if (!error) newlyUnlocked.push(id);
  }
  return newlyUnlocked;
}

// A lighter check for the duel-win routes, which don't submit a
// score and so shouldn't record an activity day or re-run every
// criterion — just the two duel-specific ones.
export async function checkDuelAchievements(supabase, userId) {
  const [{ data: already }, wins] = await Promise.all([
    supabase.from("user_achievements").select("achievement_id").eq("user_id", userId).in("achievement_id", ["first_duel_won", "duelist", "duel_master"]),
    duelWins(supabase, userId),
  ]);
  const alreadyUnlocked = new Set((already || []).map((r) => r.achievement_id));
  const newlyUnlocked = [];
  for (const id of ["first_duel_won", "duelist", "duel_master"]) {
    if (alreadyUnlocked.has(id)) continue;
    if (!CRITERIA[id]({ duelWins: wins })) continue;
    const { error } = await supabase.from("user_achievements").insert({ user_id: userId, achievement_id: id });
    if (!error) newlyUnlocked.push(id);
  }
  return newlyUnlocked;
}
