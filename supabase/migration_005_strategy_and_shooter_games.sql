-- ============================================================
-- Migration: 2 new free games
-- Run this once in Supabase SQL Editor after migration_004.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, price_paise, price_display, sort_order, is_active)
values
  ('colonyrush', 'Colony Rush', '🏰', 'Strategy', '#b6ff3e', 'Gather resources and build your colony before time runs out.', 'colonyrush', 'free', null, null, 105, true),
  ('strikezone', 'Strike Zone', '🎯', 'Shooter', '#ff5a3c', 'Precision hits only — targets score, civilians cost you.', 'strikezone', 'free', null, null, 165, true)
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
