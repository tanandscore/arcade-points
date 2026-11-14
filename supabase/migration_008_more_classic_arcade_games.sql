-- ============================================================
-- Migration: 3 more classic arcade games
-- Run this once in Supabase SQL Editor after migration_007.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, price_paise, price_display, sort_order, is_active)
values
  ('brickblaster', 'Brick Blaster', '🧱', 'Arcade', '#ff5a3c', 'Break every brick. Don''t let the ball fall.', 'brickblaster', 'free', null, null, 55, true),
  ('blockcascade', 'Block Cascade', '🟦', 'Arcade', '#3ee6e0', 'Stack, rotate, and clear falling blocks.', 'blockcascade', 'free', null, null, 65, true),
  ('mazemuncher', 'Maze Muncher', '🟡', 'Arcade', '#ffb703', 'Collect every dot. Dodge every critter.', 'mazemuncher', 'free', null, null, 75, true)
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
