// Games AND subscription plans now both live in the database — that's
// what lets you edit prices, add one-time games, or change the
// subscription amount without touching code or GitHub. This file only
// fetches and shapes that data.
//
// The one thing that still lives in code is which React component
// renders each game's gameplay (components/games/GameComponents.js) —
// that part is unavoidable since it's actual game logic, not config.

import { createServerSupabase } from "./supabaseServer";

async function getPlansById(supabase) {
  const { data } = await supabase.from("subscription_plans").select("*").eq("is_active", true);
  const map = {};
  for (const p of data || []) map[p.id] = p;
  return map;
}

function shapeGame(row, plansById) {
  const plan = row.subscription_plan_id ? plansById[row.subscription_plan_id] : null;
  return {
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    category: row.category,
    accentColor: row.accent_color,
    tagline: row.tagline,
    componentKey: row.component_key,
    accessType: row.access_type, // 'free' | 'onetime' | 'subscription'
    free: row.access_type === "free",
    pricePaise: row.access_type === "onetime" ? row.price_paise : plan?.price_paise ?? null,
    priceDisplay: row.access_type === "onetime" ? row.price_display : plan?.price_display ?? null,
    subscriptionPlanId: row.subscription_plan_id,
    subscriptionPlanName: plan?.name ?? null,
    underMaintenance: row.under_maintenance ?? false,
  };
}

export async function getGames() {
  const supabase = await createServerSupabase();
  const [{ data: rows, error }, plansById] = await Promise.all([
    supabase.from("games").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
    getPlansById(supabase),
  ]);
  if (error || !rows) return [];
  return rows.map((row) => shapeGame(row, plansById));
}

export async function getGame(slug) {
  const supabase = await createServerSupabase();
  const [{ data: row, error }, plansById] = await Promise.all([
    supabase.from("games").select("*").eq("slug", slug).eq("is_active", true).maybeSingle(),
    getPlansById(supabase),
  ]);
  if (error || !row) return null;
  return shapeGame(row, plansById);
}

export async function getCategories() {
  const games = await getGames();
  return [...new Set(games.map((g) => g.category))];
}

// "Popular" = number of distinct players who've set a score in that
// game — a real usage signal already sitting in the scores table
// (one row per user per game), not a fabricated number.
export async function getPopularGames(limit = 5) {
  const supabase = await createServerSupabase();
  const [{ data: scoreRows }, games] = await Promise.all([supabase.from("scores").select("game"), getGames()]);

  const counts = {};
  for (const row of scoreRows || []) {
    counts[row.game] = (counts[row.game] || 0) + 1;
  }

  return games
    .map((g) => ({ ...g, playerCount: counts[g.slug] || 0 }))
    .filter((g) => g.playerCount > 0)
    .sort((a, b) => b.playerCount - a.playerCount)
    .slice(0, limit);
}

export async function getSubscriptionPlan(planId) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}
