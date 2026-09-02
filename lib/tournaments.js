import { createServiceSupabase } from "@/lib/supabaseServer";

// The two real multiplayer games — everything else on this list is
// ranked by tournament_scores instead. Kept as an explicit list
// rather than inferring it from game metadata, since "does this game
// have real matchmaking" isn't something the games table tracks and
// guessing wrong here would silently rank a score-based game by a
// win count that will always read zero.
const DUEL_GAMES = ["grandprixduel", "territoryduel"];

export function tournamentStatus(t) {
  const now = new Date();
  if (now < new Date(t.starts_at)) return "upcoming";
  if (now > new Date(t.ends_at)) return "ended";
  return "active";
}

export async function getTournaments() {
  const service = createServiceSupabase();
  const { data } = await service.from("tournaments").select("*").order("starts_at", { ascending: true });
  return (data || []).map((t) => ({ ...t, status: tournamentStatus(t) }));
}

export async function getTournament(id) {
  const service = createServiceSupabase();
  const { data } = await service.from("tournaments").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return { ...data, status: tournamentStatus(data) };
}

// Returns { [gameSlug]: [{ userId, username, value }, ...] }, sorted
// best-first, capped at 50 per game. `value` is a score for
// score-based games or a win count for duel games — the UI is
// responsible for labeling it correctly per game type, this just
// returns the right number.
export async function getTournamentStandings(tournament) {
  const service = createServiceSupabase();
  const standings = {};

  for (const slug of tournament.game_slugs) {
    if (DUEL_GAMES.includes(slug)) {
      const { data: duels } = await service
        .from("duels")
        .select("winner_id")
        .eq("game_slug", slug)
        .eq("status", "finished")
        .not("winner_id", "is", null)
        .gte("updated_at", tournament.starts_at)
        .lte("updated_at", tournament.ends_at);
      const wins = {};
      for (const d of duels || []) wins[d.winner_id] = (wins[d.winner_id] || 0) + 1;
      const userIds = Object.keys(wins);
      const { data: profiles } = userIds.length ? await service.from("profiles").select("id, username").in("id", userIds) : { data: [] };
      const nameById = Object.fromEntries((profiles || []).map((p) => [p.id, p.username]));
      standings[slug] = userIds
        .map((userId) => ({ userId, username: nameById[userId] || "player", value: wins[userId] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 50);
    } else {
      const { data: rows } = await service
        .from("tournament_scores")
        .select("user_id, best_score")
        .eq("tournament_id", tournament.id)
        .eq("game", slug)
        .order("best_score", { ascending: false })
        .limit(50);
      const userIds = (rows || []).map((r) => r.user_id);
      const { data: profiles } = userIds.length ? await service.from("profiles").select("id, username").in("id", userIds) : { data: [] };
      const nameById = Object.fromEntries((profiles || []).map((p) => [p.id, p.username]));
      standings[slug] = (rows || []).map((r) => ({ userId: r.user_id, username: nameById[r.user_id] || "player", value: r.best_score }));
    }
  }

  return standings;
}

export function isDuelGame(slug) {
  return DUEL_GAMES.includes(slug);
}
