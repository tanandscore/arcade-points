-- ============================================================
-- Migration: 2 flagship arcade games
-- Run this once in Supabase SQL Editor after migration_006.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, price_paise, price_display, sort_order, is_active)
values
  ('platformquest', 'Platform Quest', '🍄', 'Arcade', '#ff5a3c', 'Stomp enemies, grab coins, clear every pit.', 'platformquest', 'free', null, null, 35, true),
  ('creatureclash', 'Creature Clash', '🔥', 'Arcade', '#3ee6e0', 'Pick your creature and battle through a 5-round gauntlet.', 'creatureclash', 'free', null, null, 45, true)
on conflict (slug) do update set
  name = excluded.name,
  icon = excluded.icon,
  category = excluded.category,
  accent_color = excluded.accent_color,
  tagline = excluded.tagline,
  component_key = excluded.component_key,
  access_type = excluded.access_type,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
