-- ============================================================
-- Migration: Apex Circuit - genuine 3D racing game (Premium)
-- Run this once in Supabase SQL Editor after migration_009.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('apexcircuit', 'Apex Circuit', '🏎️', 'Premium', '#3ee6e0', 'A real 3D track. Steer, boost, and chase the fastest lap.', 'apexcircuit', 'subscription', 'premium', null, null, 155, true)
on conflict (slug) do update set
  name = excluded.name,
  icon = excluded.icon,
  category = excluded.category,
  accent_color = excluded.accent_color,
  tagline = excluded.tagline,
  component_key = excluded.component_key,
  access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
