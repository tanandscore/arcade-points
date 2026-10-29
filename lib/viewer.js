// Who is looking at this page? Every store page needs the same few facts about the signed-in player (name and points for the top
// bar, their pass, their best scores), so they are fetched in one place. Signed-out visitors get the same object, mostly empty.
import { createServerSupabase } from "./supabaseServer";
import { activeTier } from "./access";

export async function getViewer() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null, username: null, points: 0, bestByGame: {}, tier: null, isAdmin: false };

  const [{ data: profile }, { data: scores }] = await Promise.all([
    supabase.from("profiles").select("username, is_admin, is_premium, bonus_subscription_until").eq("id", user.id).single(),
    supabase.from("scores").select("game, score").eq("user_id", user.id),
  ]);
  const bestByGame = {};
  let points = 0;
  for (const r of scores || []) {
    points += r.score;
    bestByGame[r.game] = Math.max(bestByGame[r.game] || 0, r.score);
  }
  const tier = await activeTier(supabase, user.id, profile);
  return { supabase, user, profile, username: profile?.username || user.email, points, bestByGame, tier, isAdmin: profile?.is_admin === true };
}
