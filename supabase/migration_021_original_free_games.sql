-- ============================================================
-- Migration: two original free games, not reinterpretations of any
-- existing genre — Echo Chase (dodge live replays of your own past
-- movement) and Pulse Maze (cross a field of rhythm-timed gates).
-- Both include the same auto-continuing level progression as the
-- rest of the free tier.
-- Run this once in Supabase SQL Editor after migration_020.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, price_paise, price_display, sort_order, is_active)
values
  ('echochase', 'Echo Chase', '👻', 'Arcade', '#3ee6e0', 'Your own past movement comes back to hunt you.', 'echochase', 'free', null, null, 90, true),
  ('pulsemaze', 'Pulse Maze', '🚧', 'Arcade', '#ff3ea5', 'Time your crossing to the pulse. Miss it and it hurts.', 'pulsemaze', 'free', null, null, 92, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  sort_order = excluded.sort_order, is_active = excluded.is_active;
