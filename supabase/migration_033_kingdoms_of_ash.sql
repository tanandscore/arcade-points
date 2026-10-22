-- ============================================================
-- Migration: Kingdoms of Ash — a ninth Legend Pass game, and a
-- genuine pace change from every other title in the tier: a calm
-- kingdom builder, not a reflex game. Place buildings, and villagers
-- walk to work entirely on their own — gathering wood, farming food,
-- quarrying stone, minting gold — while a full day-night cycle runs
-- (buildings glow warm at night), the season drifts from spring
-- green toward autumn amber over the session, occasional rain
-- passes through, and bandits periodically test your Watch Towers.
-- Built from a spec asking for 1000 villagers, a massive procedural
-- map, a hero system, and 4 full seasons — scoped honestly down to
-- one fixed, hand-placed map and ~7 building types, with the actual
-- "living world" feeling intact. No keyboard input at all (mouse
-- only), so nothing here could ever hit the arrow-key scroll bug.
-- Run this once in Supabase SQL Editor after migration_032.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('kingdomsofash', 'Kingdoms of Ash', '🏰', 'Legend Pass', '#ffb703', 'A calm kingdom builder — place buildings, watch villagers work, live through a day-night cycle.', 'kingdomsofash', 'subscription', 'premium_plus', null, null, 300, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
