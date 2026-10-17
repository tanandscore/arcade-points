-- ============================================================
-- Migration: Emberlight — a tenth Legend Pass game, and the first
-- with real melee combat: a mouse-aimed arc swing with a genuine
-- 3-hit combo chain, a dash with actual invulnerability frames, and
-- a heavier cooldown-based special — the specific thing Hades is
-- loved for. Painterly, warm-toned atmosphere instead of the
-- neon/dark palette used elsewhere (sun shafts, drifting light
-- motes, ground fog, bloom), inspired by Journey/Gris/Sky. 3 rooms
-- of enemies, a blessing choice between each (pick 1 of 2 run
-- upgrades), then a two-phase boss with a telegraphed burst attack.
-- Content budget matched the spec directly: 1 biome, 1 weapon, 3
-- enemies, 1 boss. Desktop-only (mouse-aim), fullscreen from the
-- start, arrow-key scroll fix included from the first line.
-- Run this once in Supabase SQL Editor after migration_033.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('emberlight', 'Emberlight', '🔥', 'Legend Pass', '#ffb703', 'Real melee combat — combo swings, a dash with i-frames, and a boss with a real second phase.', 'emberlight', 'subscription', 'premium_plus', null, null, 310, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
