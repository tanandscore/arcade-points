-- ============================================================
-- Migration: Arena Survivor — a fourth Legend Pass game, and
-- structurally the most different of the four: discrete waves
-- separated by a currency-driven shop (Material), rather than
-- continuous survival with random mid-combat upgrade cards. Features
-- a genuine weapon-merging system (3 of the same weapon at the same
-- tier fuse into a stronger one), 4 enemy types including a
-- damage-on-death Exploder, and two bosses — a mid-run Arena
-- Guardian and a final Void Overlord — each with a real phase
-- transition and a telegraphed charge attack. Desktop-only,
-- fullscreen from the start, original theme/roster.
-- Run this once in Supabase SQL Editor after migration_027.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('arenasurvivor', 'Arena Survivor', '🎯', 'Legend Pass', '#ff3ea5', '8 waves, a shop between each, and a weapon-merging system. Build your loadout.', 'arenasurvivor', 'subscription', 'premium_plus', null, null, 250, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
