-- ============================================================
-- Migration: 3 new classic arcade games (first batch of 20 planned)
-- Run this once in Supabase SQL Editor after migration_014.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, price_paise, price_display, sort_order, is_active)
values
  ('stardefender', 'Star Defender', '👾', 'Arcade', '#3ee6e0', 'Hold the line against wave after wave.', 'stardefender', 'free', null, null, 80, true),
  ('voiddrifter', 'Void Drifter', '🛸', 'Arcade', '#ffb703', 'Drift through open space. The field wraps at every edge.', 'voiddrifter', 'free', null, null, 82, true),
  ('swarmbreach', 'Swarm Breach', '🐛', 'Arcade', '#ff3ea5', 'Weaving swarm creatures descend. Don''t let them land.', 'swarmbreach', 'free', null, null, 84, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  sort_order = excluded.sort_order, is_active = excluded.is_active;
