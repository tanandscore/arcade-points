-- ============================================================
-- Migration: Bloodmoon Siege — a horde survival roguelite for the
-- Legend Pass tier, in the spirit of games like Vampire Survivors /
-- Brotato (an original theme and roster, not a reproduction of any
-- existing commercial game). Canvas-based, with genuine pixel-grid
-- sprites and real particle effects, no new infrastructure needed —
-- deploys the same way as every other game on the site.
-- Run this once in Supabase SQL Editor after migration_024.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('bloodmoonsiege', 'Bloodmoon Siege', '🌒', 'Legend Pass', '#ff3ea5', 'An endless horde. Auto-attacks, real upgrades, two bosses. Survive the night.', 'bloodmoonsiege', 'subscription', 'premium_plus', null, null, 220, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
