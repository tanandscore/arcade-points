import { levelForXp } from "@/lib/xp";

// One call from each hook point (score submission, duel win) rather
// than duplicating the "which achievements unlocked, did we level
// up" logic in three separate route files. Every event logged here
// corresponds to something that genuinely just happened — nothing
// simulated for feed-filling purposes.
export async function logActivityEvents(supabase, userId, { xpGained = 0, newlyUnlockedAchievements = [], primaryEvent = null } = {}) {
  const { data: profile } = await supabase.from("profiles").select("platform_xp, activity_visible").eq("id", userId).maybeSingle();
  if (!profile || profile.activity_visible === false) return;

  const events = [];
  if (primaryEvent) events.push(primaryEvent);

  if (newlyUnlockedAchievements.length > 0) {
    const { data: defs } = await supabase.from("achievements").select("id, name").in("id", newlyUnlockedAchievements);
    for (const def of defs || []) {
      events.push(
        def.id === "hall_of_fame"
          ? { event_type: "hall_of_fame", game: null, meta: {} }
          : { event_type: "achievement", game: null, meta: { achievement_id: def.id, achievement_name: def.name } }
      );
    }
  }

  // platform_xp here already reflects this gain, since the increment
  // RPC runs before this function is called — subtracting xpGained
  // back out gives the level the player was at a moment ago, without
  // needing a separate read before the increment.
  if (xpGained > 0) {
    const beforeLevel = levelForXp(profile.platform_xp - xpGained);
    const afterLevel = levelForXp(profile.platform_xp);
    if (afterLevel > beforeLevel) {
      events.push({ event_type: "level_up", game: null, meta: { level: afterLevel } });
    }
  }

  if (events.length === 0) return;
  await supabase.from("activity_events").insert(events.map((e) => ({ user_id: userId, ...e })));
}

export async function getRecentActivity(supabase, limit = 20) {
  const { data } = await supabase
    .from("activity_events")
    .select("event_type, game, meta, created_at, profiles(username)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}
