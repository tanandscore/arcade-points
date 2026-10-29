import { createServerSupabase } from "./supabaseServer";

export const HALL_OF_FAME_THRESHOLD = 1000000000;
export const LEADERBOARD_DISPLAY_LIMIT = 100;

// Both branches now call a Postgres function that sorts, aggregates,
// and limits server-side (see migration_050) — this used to fetch
// every row in `scores` with no limit at all to do the same work in
// JavaScript, which is exactly the shape of query that exceeds a
// Cloudflare Worker's CPU/memory limits at real scale.
export async function getLeaderboardRows(gameSlug, limit = LEADERBOARD_DISPLAY_LIMIT) {
  const supabase = await createServerSupabase();

  if (gameSlug === "overall") {
    const { data } = await supabase.rpc("leaderboard_overall_top", { p_limit: limit });
    return (data || []).map((row) => ({
      userId: row.user_id,
      username: row.username || "player",
      country: row.country || null,
      isPremium: row.is_premium || false,
      total: Number(row.total),
    }));
  }

  const { data } = await supabase.rpc("leaderboard_top", { p_game: gameSlug, p_limit: limit });
  return (data || []).map((row) => ({
    userId: row.user_id,
    username: row.username || "player",
    country: row.country || null,
    isPremium: row.is_premium || false,
    total: row.score,
  }));
}

// A specific user's overall rank — computed with a window function
// in Postgres (see user_overall_rank in migration_050), not by
// fetching every player's total and finding an array index in JS.
export async function getUserOverallRank(userId) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("user_overall_rank", { p_user_id: userId });
  const row = data?.[0];
  return row ? { rank: Number(row.rnk), total: Number(row.total) } : null;
}

// Same reasoning, scoped to one game's leaderboard.
export async function getUserGameRank(userId, gameSlug) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("user_game_rank", { p_user_id: userId, p_game: gameSlug });
  const row = data?.[0];
  return row ? { rank: Number(row.rnk), score: row.score } : null;
}

export async function getHallOfFame() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, country, lifetime_points")
    .gte("lifetime_points", HALL_OF_FAME_THRESHOLD)
    .order("lifetime_points", { ascending: false })
    .limit(500); // the threshold is extreme (1 billion lifetime points) so this stays naturally small in practice — the limit is defense-in-depth, not a fix for an observed problem
  return data || [];
}
