// How far a player has got in each of the 2D games, read from their cloud save (table game_saves, see migration_088).
// Everything here is safe to call before that table exists: it just returns "no progress".
import { isKitSlug } from "./catalog";

// levels = the `levels` object of a save: { "1-1": { stars, best, time }, … }
export function summarise(levels) {
  const arr = levels && typeof levels === "object" ? Object.values(levels) : [];
  let done = 0;
  let stars = 0;
  for (const l of arr) {
    if (!l || typeof l !== "object") continue;
    if (l.stars > 0 || l.best > 0) done += 1;
    stars += Math.max(0, Math.min(3, Number(l.stars) || 0));
  }
  return { done, stars };
}

// → { kikoleap: { done: 5, stars: 11 }, … }  (only the games the player has saved progress in)
export async function getSaveSummaries(supabase, userId) {
  try {
    const { data, error } = await supabase.from("game_saves").select("game, levels:data->levels").eq("user_id", userId);
    if (error || !Array.isArray(data)) return {};
    const out = {};
    for (const r of data) if (isKitSlug(r.game)) out[r.game] = summarise(r.levels);
    return out;
  } catch {
    return {};
  }
}

export async function getSaveSummary(supabase, userId, slug) {
  const all = await getSaveSummaries(supabase, userId);
  return all[slug] || null;
}
