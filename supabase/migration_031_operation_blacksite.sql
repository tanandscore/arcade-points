-- ============================================================
-- Migration: Operation Blacksite — a seventh Legend Pass game, and a
-- genuinely different genre from all 6 existing ones: mouse-aimed
-- hitscan shooting, a round-based buy-phase economy, a bomb
-- plant/defuse objective instead of a survival timer, and AI bots
-- with real behavior states (patrol/search/engage/rush-the-bomb)
-- rather than "walk toward player." Built from a large Counter-Strike
-- inspired production spec — scoped honestly down to one map, 3
-- weapons, and best-of-5 rounds, with real visual investment (bullet
-- tracers, muzzle flashes, dynamic player light, screen shake,
-- damage flash, low-health vignette) since that was the explicit
-- ask. Original names throughout. Desktop-only (mouse-aim requires
-- it), fullscreen from the start, arrow-key scroll fix included.
-- Run this once in Supabase SQL Editor after migration_030.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('operationblacksite', 'Operation Blacksite', '🎯', 'Legend Pass', '#ff3ea5', 'Mouse-aimed tactical shooting, a buy phase, and a bomb to plant or defuse.', 'operationblacksite', 'subscription', 'premium_plus', null, null, 280, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
