-- ============================================================
-- Migration: Midnight Burn — the site's flagship game (Legend Pass).
-- An original neon night street-racing career: six maps (Harbor
-- Loop, Downtown Grid, Foundry Run, Neon Strip, Skyline Ridge,
-- Eclipse Raceway) with clear nights, rain, fog and thunderstorms,
-- traffic, five rivals, a garage with upgrades, and three quests
-- in every map that open up after each race. Desktop only,
-- keyboard controlled. Original cars, tracks and names.
--
-- It sorts first inside Legend Pass (sort_order 195) and is the
-- hero card in the "Featured" strip on the landing page and the
-- dashboard (see components/FlagshipBanner.js).
--
-- Staged as admin_test_only = true: it is live but visible ONLY to
-- admin accounts, so you can play-test it on the real site first.
-- When you are happy, run the one-line "go public" statement at the
-- bottom of this file.
--
-- Safe to run more than once (it updates the game if it exists, and
-- never changes the admin_test_only setting of an existing row).
-- Run this once in Supabase SQL Editor after migration_069.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active, admin_test_only)
values
  ('midnightburn', 'Midnight Burn', '🌃', 'Legend Pass', '#ff2d95', 'A six-map neon street-racing career. Rain, fog, traffic, rivals, a garage, and quests hidden in every map.', 'midnightburn', 'subscription', 'premium_plus', null, null, 195, true, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;

-- GO PUBLIC (run later, only when you are happy with it):
-- update public.games set admin_test_only = false where slug = 'midnightburn';
