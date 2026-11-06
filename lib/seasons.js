// Titles are derived from season_xp, never stored — same philosophy
// as level being derived from platform_xp in lib/xp.js. Changing
// these thresholds later never needs a migration or backfill.
export const SEASON_TITLES = [
  { threshold: 0, title: "Season Rookie" },
  { threshold: 500, title: "Season Regular" },
  { threshold: 2000, title: "Season Veteran" },
  { threshold: 5000, title: "Season Legend" },
];

export function titleForSeasonXp(xp) {
  let current = SEASON_TITLES[0];
  for (const tier of SEASON_TITLES) {
    if (xp >= tier.threshold) current = tier;
  }
  return current.title;
}

export async function getActiveSeason(supabase) {
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("seasons")
    .select("id, name, badge_icon, ends_at")
    .lte("starts_at", nowIso)
    .gte("ends_at", nowIso)
    .maybeSingle();
  return data || null;
}

// The single place every route should award XP through — awards
// lifetime platform XP as before, and mirrors the same amount into
// the currently active season's running total, if one exists. This
// replaces direct increment_platform_xp calls in the score/duel
// routes so season-XP mirroring can never be forgotten in one of
// them.
export async function awardXp(supabase, userId, amount) {
  if (amount <= 0) return;
  await supabase.rpc("increment_platform_xp", { p_user_id: userId, p_amount: amount });
  const season = await getActiveSeason(supabase);
  if (season) {
    await supabase.rpc("increment_season_xp", { p_user_id: userId, p_season_id: season.id, p_amount: amount });
  }
}
