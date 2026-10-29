// Games and subscription plans.
//
// Upgrade 70: WHICH games exist, which tier each belongs to and how they are described now lives in lib/catalog.js (one file, in code).
// The database still provides the live switches an owner flips from the admin area — a game on or off (is_active), "updating"
// mode (under_maintenance), admin-test-only — plus the subscription plans and their prices (editable with no code change).
// This file merges the two. A game that is in the catalogue but has no database row yet is still shown, so the store works
// even before the Upgrade 70 SQL has been run. A game in the database that is NOT in the catalogue is retired and hidden.
//
// The one thing that still lives elsewhere is which React component renders each game's gameplay (games/GameComponents.js).

import { cache } from "react";
import { createServerSupabase, createServiceSupabase } from "./supabaseServer";
import { CATALOG, TIERS, isNewGame, capsuleOf } from "./catalog";

// React's cache() de-duplicates identical calls inside ONE request (the layout, the page and its parts all ask for the games).
const loadPlans = cache(async () => {
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase.from("subscription_plans").select("*").eq("is_active", true);
    const map = {};
    for (const p of data || []) map[p.id] = p;
    return map;
  } catch { return {}; }
});

const loadRows = cache(async () => {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.from("games").select("*");
    return error || !data ? [] : data;
  } catch { return []; }
});

function shapeGame(c, row, plansById) {
  const tier = TIERS[c.tier];
  const plan = tier.planId ? plansById[tier.planId] : null;
  return {
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    category: c.genre, // kept under its old name so older code keeps working: it is now the genre ("Platformer", "Puzzle", …)
    genre: c.genre,
    style: c.style,
    tier: c.tier,
    tierName: tier.name,
    tierColor: tier.color,
    status: c.status,
    kit: !!c.kit,
    desktopOnly: !!c.desktopOnly,
    isNew: isNewGame(c),
    added: c.added || null,
    featured: c.featured || 0,
    order: c.order,
    accentColor: c.accent,
    tagline: c.tagline,
    about: c.about || [],
    features: c.features || [],
    pitch: c.pitch || [],
    tags: c.tags || [],
    stats: c.stats || [],
    modes: c.modes || ["Single-player"],
    levels: c.levels || 0,
    controls: c.controls || null,
    touchControls: c.touchControls || null,
    capsule: capsuleOf(c),
    shots: c.shots || [],
    componentKey: row?.component_key || c.slug,
    accessType: tier.planId ? "subscription" : "free", // 'free' | 'subscription'
    free: !tier.planId,
    pricePaise: plan?.price_paise ?? null,
    priceDisplay: plan?.price_display ?? null,
    subscriptionPlanId: tier.planId,
    subscriptionPlanName: tier.planId ? plan?.name ?? tier.name : null,
    // Fungies is the site's only payment provider — see migration_068_fungies_payment_provider.sql. Its checkout needs the full
    // "checkout element" URL for each plan/billing period, so the whole URL is stored and read straight through. Null until set
    // in the subscription_plans table (editable with no code change); a plan without them shows "not configured yet".
    subscriptionPlanFungiesCheckoutUrlMonthly: plan?.fungies_checkout_url_monthly ?? null,
    subscriptionPlanFungiesCheckoutUrlAnnual: plan?.fungies_checkout_url_annual ?? null,
    subscriptionPlanFungiesPriceDisplayMonthly: plan?.fungies_price_display_monthly ?? null,
    subscriptionPlanFungiesPriceDisplayAnnual: plan?.fungies_price_display_annual ?? null,
    underMaintenance: row?.under_maintenance ?? false,
    adminTestOnly: row?.admin_test_only ?? false,
  };
}

// Every live, playable game, in store order.
async function loadLive(includeTestOnly) {
  const [rows, plansById] = await Promise.all([loadRows(), loadPlans()]);
  const bySlug = Object.fromEntries(rows.map((r) => [r.slug, r]));
  const out = [];
  for (const c of CATALOG) {
    if (c.status !== "live") continue;
    const row = bySlug[c.slug];
    if (row && row.is_active === false) continue; // switched off from the admin area
    if (row?.admin_test_only && !includeTestOnly) continue;
    out.push(shapeGame(c, row, plansById));
  }
  return out.sort((a, b) => a.order - b.order);
}
const liveWithTest = cache(() => loadLive(true));
const livePublic = cache(() => loadLive(false));

export async function getGames({ includeTestOnly = false } = {}) {
  return includeTestOnly ? liveWithTest() : livePublic();
}

export async function getGame(slug) {
  const all = await liveWithTest();
  return all.find((g) => g.slug === slug) || null;
}

// The "Coming soon" row of the store.
export const getComingSoon = cache(async () => {
  const plansById = await loadPlans();
  return CATALOG.filter((c) => c.status === "soon").map((c) => shapeGame(c, null, plansById)).sort((a, b) => a.order - b.order);
});

// A game page can also be shown for a game that is announced but not playable yet.
export async function getStoreGame(slug) {
  const live = await getGame(slug);
  if (live) return live;
  const soon = await getComingSoon();
  return soon.find((g) => g.slug === slug) || null;
}

// The genres that currently have at least one game (kept for older code).
export async function getCategories() {
  const games = await getGames();
  return [...new Set(games.map((g) => g.genre))];
}

// "Most played" = how many times each game has been played to the end.
//
// This used to download the whole `scores` table and count it in JavaScript — but the database only returns its first 1,000
// rows, so once the site passed 1,000 saved scores the ranking stopped moving. Now the counting happens inside the database
// (migration_079), so it is exact, instant and never truncated. Three levels, best first:
//   1. game_play_totals   — real play counts (migration_079)
//   2. game_player_counts — different players per game (migration_047)
//   3. last resort        — the old scores count, so the list never breaks
// Totals are read with the service client because ordinary player accounts can only see their own rows; only counts leave
// this function.
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

// Prices of the two passes, for the pricing page and the store's upsell boxes.
export async function getPassPlans() {
  const plansById = await loadPlans();
  const pick = (id, tier) => {
    const p = plansById[id] || null;
    return {
      tier, id, name: p?.name || TIERS[tier].name,
      monthly: p?.fungies_price_display_monthly || p?.price_display || null,
      annual: p?.fungies_price_display_annual || null,
      checkoutMonthly: p?.fungies_checkout_url_monthly || null,
      checkoutAnnual: p?.fungies_checkout_url_annual || null,
    };
  };
  return { power: pick("premium", "power"), legend: pick("premium_plus", "legend") };
}
