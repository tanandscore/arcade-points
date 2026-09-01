import { createServiceSupabase } from "@/lib/supabaseServer";
import { getUserOverallRank, HALL_OF_FAME_THRESHOLD } from "@/lib/leaderboard";
import { levelProgress } from "@/lib/xp";
import { currentStreakDays } from "@/lib/achievements";
import { getActiveSeason, titleForSeasonXp } from "@/lib/seasons";

// Deliberately built entirely on the service client, not the
// caller's own session — a public profile is, by definition, about
// viewing someone ELSE's data. This never exposes anything beyond
// what's already treated as showable elsewhere on the site
// (achievements, leaderboard position, lifetime points) — it never
// reads purchases, subscriptions, or email.
export async function getPublicProfile(username) {
  const service = createServiceSupabase();

  const { data: profile } = await service
    .from("profiles")
    .select("id, username, platform_xp, lifetime_points, longest_streak, created_at")
    .eq("username", username)
    .maybeSingle();
  if (!profile) return null;

  const [{ data: scoreRows }, { data: recentRows }, rankResult, streakDays, activeSeason] = await Promise.all([
    service.from("scores").select("game").eq("user_id", profile.id),
    service.from("last_played").select("game, played_at").eq("user_id", profile.id).order("played_at", { ascending: false }).limit(5),
    getUserOverallRank(profile.id),
    currentStreakDays(service, profile.id),
    getActiveSeason(service),
  ]);

  const gamesPlayedCount = new Set((scoreRows || []).map((r) => r.game)).size;

  let season = null;
  if (activeSeason) {
    const { data: seasonXpRow } = await service
      .from("user_season_xp")
      .select("season_xp")
      .eq("user_id", profile.id)
      .eq("season_id", activeSeason.id)
      .maybeSingle();
    const seasonXp = seasonXpRow?.season_xp || 0;
    season = {
      name: activeSeason.name,
      badgeIcon: activeSeason.badge_icon,
      xp: seasonXp,
      title: titleForSeasonXp(seasonXp),
    };
  }

  return {
    username: profile.username,
    memberSince: profile.created_at,
    lifetimePoints: profile.lifetime_points || 0,
    longestStreak: Math.max(profile.longest_streak || 0, streakDays),
    currentStreak: streakDays,
    gamesPlayedCount,
    isHallOfFame: (profile.lifetime_points || 0) >= HALL_OF_FAME_THRESHOLD,
    overallRank: rankResult?.rank || null,
    xp: levelProgress(profile.platform_xp || 0),
    recentlyPlayed: recentRows || [],
    season,
  };
}
