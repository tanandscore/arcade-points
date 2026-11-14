-- ============================================================
-- Migration: final 5 classic-arcade-inspired games (Premium),
-- completing the requested franchise-inspired list. Pac-Man and Out
-- Run were already covered by Maze Muncher and the racing games.
-- Run this once in Supabase SQL Editor after migration_016.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('fruitchase', 'Fruit Chase', '🍒', 'Premium', '#ffb703', 'Power pellets turn the tables. Chase the bonus fruit.', 'fruitchase', 'subscription', 'premium', null, null, 170, true),
  ('ironfist', 'Iron Fist', '👊', 'Premium', '#ff5a3c', 'Read your opponent. Counter. Land the finishing strike.', 'ironfist', 'subscription', 'premium', null, null, 172, true),
  ('shellsquad', 'Shell Squad', '🐢', 'Premium', '#3ee6e0', 'Surrounded on every side. Strike fast, stay mobile.', 'shellsquad', 'subscription', 'premium', null, null, 174, true),
  ('rimrockers', 'Rim Rockers', '🏀', 'Premium', '#ff3ea5', 'Time your shot. Chain makes to catch fire.', 'rimrockers', 'subscription', 'premium', null, null, 176, true),
  ('beatrush', 'Beat Rush', '🎵', 'Premium', '#a99fd6', 'Hit every beat on time. Chain the combo.', 'beatrush', 'subscription', 'premium', null, null, 178, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
