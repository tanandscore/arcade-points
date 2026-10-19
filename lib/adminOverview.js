import { createServiceSupabase } from "@/lib/supabaseServer";
import { getGames } from "@/lib/games";

function toIsoDate(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

// Every number here is a real query result. Where a figure is
// necessarily an estimate rather than an exact fact — revenue,
// specifically, since no table anywhere records the actual amount
// paid, only list prices and purchase/subscription counts — it's
// labeled as such in the shape returned, not silently presented as
// precise.
export async function getPlatformOverview() {
  const service = createServiceSupabase();
  const now = new Date();
  const todayStart = toIsoDate(now);
  const sevenDaysAgoDate = toIsoDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).slice(0, 10);
  const thirtyDaysAgoDate = toIsoDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)).slice(0, 10);
  const todayDate = todayStart.slice(0, 10);

  const [
    { count: totalUsers },
    { data: todaysPlays },
    { data: activeSubs },
    { data: purchases },
    { data: plans },
    games,
    dauResult,
    wauResult,
    mauResult,
  ] = await Promise.all([
    service.from("profiles").select("id", { count: "exact", head: true }),
    service.from("last_played").select("game, user_id").gte("played_at", todayStart),
    service.from("subscriptions").select("plan_id").eq("status", "active"),
    service.from("purchases").select("game"),
    service.from("subscription_plans").select("id, price_paise"),
    getGames(),
    // DAU/WAU/MAU counted in Postgres via distinct_active_users (see
    // migration_050), not by fetching every activity_days row in
    // range and building a Set in the Worker — at 100k+ daily-active
    // users that was a genuine, unbounded memory/CPU risk on every
    // single admin page load.
    service.rpc("distinct_active_users", { since_date: todayDate }),
    service.rpc("distinct_active_users", { since_date: sevenDaysAgoDate }),
    service.rpc("distinct_active_users", { since_date: thirtyDaysAgoDate }),
  ]);

  const dau = dauResult.data || 0;
  const wau = wauResult.data || 0;
  const mau = mauResult.data || 0;
  const activeUsersToday = new Set((todaysPlays || []).map((r) => r.user_id)).size;
  const distinctGamesPlayedToday = new Set((todaysPlays || []).map((r) => r.game)).size;

  const plansById = Object.fromEntries((plans || []).map((p) => [p.id, p]));
  const mrrPaise = (activeSubs || []).reduce((sum, s) => sum + (plansById[s.plan_id]?.price_paise || 0), 0);

  const gamesBySlug = Object.fromEntries(games.map((g) => [g.slug, g]));
  const purchaseRevenuePaiseAllTime = (purchases || []).reduce((sum, p) => sum + (gamesBySlug[p.game]?.pricePaise || 0), 0);

  // Aggregated in Postgres, not fetched-and-counted-in-JS — this was
  // previously a second, redundant full-table scan of last_played on
  // top of the one getHiddenGems already runs on the dashboard, and
  // the single worst offender in the whole admin page.
  const { data: playerCounts } = await service.rpc("game_player_counts", { since: null });
  const topGames = (playerCounts || [])
    .map((row) => ({ slug: row.game, name: gamesBySlug[row.game]?.name || row.game, icon: gamesBySlug[row.game]?.icon || "🎮", players: row.player_count }))
    .sort((a, b) => b.players - a.players)
    .slice(0, 8);

  return {
    totalUsers: totalUsers || 0,
    totalGamesInCatalog: games.length,
    dau,
    wau,
    mau,
    activeUsersToday,
    distinctGamesPlayedToday,
    activeSubscribers: (activeSubs || []).length,
    mrrPaise,
    purchaseRevenuePaiseAllTime,
    topGames,
    revenueIsEstimate: true,
  };
}
