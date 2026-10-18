// Games AND subscription plans now both live in the database — that's
// what lets you edit prices, add one-time games, or change the
// subscription amount without touching code or GitHub. This file only
// fetches and shapes that data.
//
// The one thing that still lives in code is which React component
// renders each game's gameplay (games/GameComponents.js) —
// that part is unavoidable since it's actual game logic, not config.

import { createServerSupabase, createServiceSupabase } from "./supabaseServer";
import { LEGEND_FLAGSHIP_SLUGS, LEGEND_PLAN_ID } from "./flagshipSlugs";

async function getPlansById(supabase) {
  const { data } = await supabase.from("subscription_plans").select("*").eq("is_active", true);
  const map = {};
  for (const p of data || []) map[p.id] = p;
  return map;
}

function shapeGame(rawRow, plansById) {
  // the four flagship games are Legend Pass games no matter what the database row says
  const flagship = LEGEND_FLAGSHIP_SLUGS.includes(rawRow.slug);
  const row = flagship ? { ...rawRow, category: "Legend Pass", access_type: "subscription", subscription_plan_id: LEGEND_PLAN_ID } : rawRow;
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
    // Fungies is the site's only payment provider — see
    // migration_068_fungies_payment_provider.sql. Its checkout needs
    // the full "checkout element" URL for each plan/billing period,
    // so the whole URL is stored and read straight through. Null
    // until set in the subscription_plans table (editable with no
    // code change); a plan without them shows "not configured yet".
    subscriptionPlanFungiesCheckoutUrlMonthly: plan?.fungies_checkout_url_monthly ?? null,
    subscriptionPlanFungiesCheckoutUrlAnnual: plan?.fungies_checkout_url_annual ?? null,
    subscriptionPlanFungiesPriceDisplayMonthly: plan?.fungies_price_display_monthly ?? null,
    subscriptionPlanFungiesPriceDisplayAnnual: plan?.fungies_price_display_annual ?? null,
    underMaintenance: row.under_maintenance ?? false,
    adminTestOnly: row.admin_test_only ?? false,
  };
}

export async function getGames({ includeTestOnly = false } = {}) {
  const supabase = await createServerSupabase();
  let query = supabase.from("games").select("*").eq("is_active", true).order("sort_order", { ascending: true });
  if (!includeTestOnly) query = query.eq("admin_test_only", false);
  const [{ data: rows, error }, plansById] = await Promise.all([query, getPlansById(supabase)]);
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

// "Most played" = how many times each game has been played to the end.
//
// This used to download the whole `scores` table and count it in
// JavaScript — but the database only returns its first 1,000 rows, so
// once the site passed 1,000 saved scores the ranking stopped moving.
// Now the counting happens inside the database (migration_079), so it
// is exact, instant and never truncated. Three levels, best first:
//   1. game_play_totals   — real play counts (migration_079)
//   2. game_player_counts — different players per game (migration_047)
//   3. last resort        — the old scores count, so the list never breaks
// Totals are read with the service client because ordinary player
// accounts can only see their own rows; only counts leave this function.
export async function getPopularGames(limit = 5) {
  const games = await getGames();
  const bySlug = Object.fromEntries(games.map((g) => [g.slug, g]));
  let totals = null; // [{ game, plays, players }]

  try {
    const service = createServiceSupabase();
    const first = await service.rpc("game_play_totals");
    if (!first.error && Array.isArray(first.data)) {
      totals = first.data.map((r) => ({ game: r.game, plays: Number(r.plays), players: Number(r.players) }));
    } else {
      const second = await service.rpc("game_player_counts", { since: null });
      if (!second.error && Array.isArray(second.data)) {
        totals = second.data.map((r) => ({ game: r.game, plays: Number(r.player_count), players: Number(r.player_count) }));
      }
    }
  } catch {
    totals = null;
  }

  if (!totals) {
    const supabase = await createServerSupabase();
    const { data: scoreRows } = await supabase.from("scores").select("game");
    const counts = {};
    for (const row of scoreRows || []) counts[row.game] = (counts[row.game] || 0) + 1;
    totals = Object.entries(counts).map(([game, n]) => ({ game, plays: n, players: n }));
  }

  return totals
    .filter((t) => bySlug[t.game] && t.plays > 0)
    .map((t) => ({ ...bySlug[t.game], playerCount: t.players, plays: t.plays }))
    .sort((a, b) => b.plays - a.plays || b.playerCount - a.playerCount)
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
