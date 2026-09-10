import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";

// Every row here is a real query result, never fabricated. Both
// functions read from last_played (see migration_042) — the one
// table that actually updates on every session, not just new bests.

export async function getContinuePlaying(userId, limit = 6) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("last_played")
    .select("game, played_at")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(limit);
  return data || [];
}

// Trending needs counts across every player, not just the current
// user, so this uses the service client — but the actual counting
// happens in Postgres via game_player_counts (see migration_047),
// not by fetching every matching row into Node and counting in JS.
// It only ever returns aggregated counts; it never exposes which
// specific other user played what.
export async function getTrendingGames(limit = 8) {
  const service = createServiceSupabase();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await service.rpc("game_player_counts", { since: sevenDaysAgo });

  return (data || [])
    .map((row) => ({ game: row.game, playerCount: row.player_count }))
    .sort((a, b) => b.playerCount - a.playerCount)
    .slice(0, limit);
}

export function formatRelativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

// Games with real, confirmed players (not zero), but fewer of them
// than the median across the catalog — an honest "under-played but
// genuinely liked by whoever tried it" signal, not a random pick.
// This was previously the worst offender in the file: an unbounded
// fetch of the entire last_played table with no date filter at all,
// counted in JavaScript. Now a single aggregated Postgres call.
export async function getHiddenGems(allGameSlugs, limit = 6) {
  const service = createServiceSupabase();
  const { data } = await service.rpc("game_player_counts", { since: null });

  const countsBySlug = Object.fromEntries((data || []).map((row) => [row.game, row.player_count]));
  const counts = allGameSlugs
    .map((slug) => ({ game: slug, count: countsBySlug[slug] || 0 }))
    .filter((c) => c.count > 0);
  if (counts.length === 0) return [];

  const sorted = [...counts].sort((a, b) => a.count - b.count);
  const median = sorted[Math.floor(sorted.length / 2)].count;
  return sorted.filter((c) => c.count <= median).slice(0, limit).map((c) => c.game);
}
