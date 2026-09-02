import { getGames } from "@/lib/games";

export const DAILY_CHALLENGES = [
  { id: "play_three", name: "Triple Play", description: "Play 3 different games today.", xpReward: 15 },
  { id: "beat_best", name: "Personal Best", description: "Beat a personal best today.", xpReward: 20 },
  { id: "two_categories", name: "Branch Out", description: "Play games in 2 different categories today.", xpReward: 15 },
];

function todayStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

// The pass/fail check itself, shared between the read-only dashboard
// display and the award-granting version called from /api/scores —
// written once so the two can never silently disagree with each
// other about what "completed" means.
async function computeTodayResults(supabase, userId) {
  const todayStart = todayStartIso();
  const games = await getGames();
  const gamesBySlug = Object.fromEntries(games.map((g) => [g.slug, g]));

  const [{ data: todaysPlays }, { data: todaysBests }] = await Promise.all([
    supabase.from("last_played").select("game").eq("user_id", userId).gte("played_at", todayStart),
    supabase.from("activity_events").select("id").eq("user_id", userId).eq("event_type", "new_best").gte("created_at", todayStart),
  ]);

  const distinctGamesToday = new Set((todaysPlays || []).map((r) => r.game));
  const distinctCategoriesToday = new Set([...distinctGamesToday].map((slug) => gamesBySlug[slug]?.category).filter(Boolean));

  return {
    play_three: distinctGamesToday.size >= 3,
    beat_best: (todaysBests || []).length > 0,
    two_categories: distinctCategoriesToday.size >= 2,
  };
}

async function getTodaysCompletedIds(supabase, userId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("daily_challenge_completions")
    .select("challenge_id")
    .eq("user_id", userId)
    .eq("completed_date", today);
  return new Set((data || []).map((r) => r.challenge_id));
}

// Read-only — safe to call on every dashboard load, awards nothing.
export async function getDailyChallengeStatus(supabase, userId) {
  const [results, completedIds] = await Promise.all([
    computeTodayResults(supabase, userId),
    getTodaysCompletedIds(supabase, userId),
  ]);
  return DAILY_CHALLENGES.map((c) => ({ ...c, completed: completedIds.has(c.id) || results[c.id] }));
}

// Called from /api/scores after last_played and activity_events are
// already written for this request, since two of the three
// challenges depend on reading those same-request writes back.
export async function evaluateAndAwardDailyChallenges(supabase, userId) {
  const [results, alreadyCompleted] = await Promise.all([
    computeTodayResults(supabase, userId),
    getTodaysCompletedIds(supabase, userId),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  let xpFromChallenges = 0;
  const newlyCompleted = [];
  for (const challenge of DAILY_CHALLENGES) {
    if (alreadyCompleted.has(challenge.id)) continue;
    if (!results[challenge.id]) continue;
    const { error } = await supabase
      .from("daily_challenge_completions")
      .insert({ user_id: userId, challenge_id: challenge.id, completed_date: today });
    if (!error) {
      newlyCompleted.push(challenge.id);
      xpFromChallenges += challenge.xpReward;
    }
  }
  return { newlyCompleted, xpFromChallenges };
}
