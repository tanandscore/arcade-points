import { createServerSupabase } from "./supabaseServer";

export const HALL_OF_FAME_THRESHOLD = 1000000000;

// gameSlug === "overall" sums each player's best score across every
// game they've played. Any other value filters to that one game.
export async function getLeaderboardRows(gameSlug) {
  const supabase = await createServerSupabase();

  if (gameSlug === "overall") {
    const { data } = await supabase.from("scores").select("user_id, score, profiles(username, country, is_premium)");
    const totals = {};
    for (const row of data || []) {
      const key = row.user_id;
      if (!totals[key]) {
        totals[key] = {
          userId: key,
          username: row.profiles?.username || "player",
          country: row.profiles?.country || null,
          isPremium: row.profiles?.is_premium || false,
          total: 0,
        };
      }
      totals[key].total += row.score;
    }
    return Object.values(totals).sort((a, b) => b.total - a.total);
  }

  const { data } = await supabase
    .from("scores")
    .select("user_id, score, profiles(username, country, is_premium)")
    .eq("game", gameSlug)
    .order("score", { ascending: false });

  return (data || []).map((row) => ({
    userId: row.user_id,
    username: row.profiles?.username || "player",
    country: row.profiles?.country || null,
    isPremium: row.profiles?.is_premium || false,
    total: row.score,
  }));
}

export async function getHallOfFame() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, country, lifetime_points")
    .gte("lifetime_points", HALL_OF_FAME_THRESHOLD)
    .order("lifetime_points", { ascending: false });
  return data || [];
}
