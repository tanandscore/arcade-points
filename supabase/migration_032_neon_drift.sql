-- ============================================================
-- Migration: Neon Drift — an eighth Legend Pass game, and a
-- deliberately constrained spec ("reduce content, increase visual
-- fidelity") honored directly: 3 tracks, 5 vehicles, one pseudo-3D
-- perspective-projected road (the classic arcade-racer technique —
-- no 3D engine, but genuine depth and speed sensation). Rain,
-- lightning flashes, neon-lined road edges, a glowing skyline,
-- radiating speed streaks at high velocity, boost flame particles,
-- and screen shake on boost/lightning. 3 AI rivals racing for real
-- position. Desktop-only, fullscreen from the start.
-- Run this once in Supabase SQL Editor after migration_031.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('neondrift', 'Neon Drift', '🌆', 'Legend Pass', '#3ee6e0', 'A rain-soaked cyberpunk city, 3 tracks, 5 cars, and a real sense of speed.', 'neondrift', 'subscription', 'premium_plus', null, null, 290, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
