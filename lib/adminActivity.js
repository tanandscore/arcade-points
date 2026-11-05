import { createServiceSupabase } from "@/lib/supabaseServer";

// Two honest limitations, stated plainly rather than glossed over:
// 1. "Online" here means "played something in the last 10 minutes" —
//    there's no real-time presence/websocket system on this site, so
//    this is a recent-activity proxy, not a live connection count.
// 2. Location is the country the user picked at signup, not IP-based
//    geolocation, which this site has never collected. This is a
//    "where players say they are" view, not a precise live map.
const ONLINE_WINDOW_MINUTES = 10;

export async function getLiveActivity() {
  const service = createServiceSupabase();
  const since = new Date(Date.now() - ONLINE_WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data: recentPlays } = await service
    .from("last_played")
    .select("user_id, game, played_at")
    .gte("played_at", since)
    .order("played_at", { ascending: false });

  const userIds = [...new Set((recentPlays || []).map((r) => r.user_id))];
  if (userIds.length === 0) return { onlineCount: 0, byCountry: [], recentUsers: [] };

  const { data: profiles } = await service.from("profiles").select("id, username, country").in("id", userIds);
  const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  const lastPlayByUser = {};
  for (const row of recentPlays || []) {
    if (!lastPlayByUser[row.user_id]) lastPlayByUser[row.user_id] = row; // already sorted newest-first
  }

  const countryCounts = {};
  const recentUsers = [];
  for (const userId of userIds) {
    const profile = profileById[userId];
    const country = profile?.country || "Unknown";
    countryCounts[country] = (countryCounts[country] || 0) + 1;
    recentUsers.push({
      username: profile?.username || "player",
      country,
      game: lastPlayByUser[userId].game,
      playedAt: lastPlayByUser[userId].played_at,
    });
  }

  const byCountry = Object.entries(countryCounts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);

  recentUsers.sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt));

  return { onlineCount: userIds.length, byCountry, recentUsers: recentUsers.slice(0, 50) };
}
