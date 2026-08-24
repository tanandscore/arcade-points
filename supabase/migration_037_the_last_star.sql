-- ============================================================
-- Migration: The Last Star — a twelfth Legend Pass game, a space
-- exploration title with a movement model genuinely different from
-- every other game on the site: free-floating Newtonian drift (no
-- gravity, no instant-velocity 8-way movement — thrust and coast,
-- with light drag). A 2D free-roam camera (not the horizontal-only
-- scroll used elsewhere). Layered parallax starfields, procedurally
-- varied planets (random color, atmosphere glow, optional rings,
-- generated name, and a discovery flavor line), soft nebula clouds,
-- twinkling near-stars, asteroid field hazards, and a telegraphed
-- solar flare event. 8 worlds to discover, 14 starlight fragments,
-- and the Last Star itself at the far edge of the map as the finale.
-- Includes AI-adjacent difficulty tiers (space hazard intensity)
-- with per-tier score tracking from the start. Desktop-only,
-- fullscreen, arrow-key scroll fix included.
-- Run this once in Supabase SQL Editor after migration_036.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('thelaststar', 'The Last Star', '✨', 'Legend Pass', '#ffe9b8', 'Drift through nebulas, discover worlds, and find the Last Star at the edge of the map.', 'thelaststar', 'subscription', 'premium_plus', null, null, 330, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
