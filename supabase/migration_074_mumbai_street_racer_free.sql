-- ============================================================
-- Migration: Midnight Burn goes future-only; present-day Mumbai becomes a FREE racing game.
--  * New free game "Mumbai Street Racer" (today's Mumbai, standard graphics, 12 races, one starter car).
--  * Midnight Burn card text updated for the Mumbai 2046 map.
-- Safe to run more than once. Run once in the Supabase SQL Editor after migration_073.
-- ============================================================
insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('mumbaistreetracer', 'Mumbai Street Racer', '🚕', 'Arcade', '#ffb347', 'Race across today''s Mumbai for free: Marine Drive, the Sea Link and Dharavi, 12 street races and hidden cash.', 'mumbaistreetracer', 'free', null, null, null, 61, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;

update public.games
set tagline = 'Mumbai in 2046: a free-roam night city with metro trains, two airports, festival seasons, a ten-driver ladder and your dream build.'
where slug = 'midnightburn';
