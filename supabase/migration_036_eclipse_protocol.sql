-- ============================================================
-- Migration: Eclipse Protocol — an eleventh Legend Pass game, a
-- Blade Runner-inspired cyberpunk combat title. A third distinct
-- combat shape on the tier: Emberlight is pure melee-combo,
-- Operation Blacksite is pure ranged-with-reload, this one is
-- dual-mode — a fast blade slash for close range and a pulse pistol
-- for distance, sharing a single heat gauge instead of ammo, so
-- pacing comes from managing overheat rather than reloading. Heavy
-- rain, flickering holographic billboards with occasional glitch
-- jumps, flying vehicles with light trails crossing the sky, and a
-- wet-ground neon reflection effect. 3 sectors of enemies (Sentry
-- Drones, Enforcer Units, Glitch Wraiths), then a two-phase boss —
-- the Overseer. Includes AI difficulty tiers with per-tier score
-- tracking from the start. Desktop-only, fullscreen, arrow-key
-- scroll fix included.
-- Run this once in Supabase SQL Editor after migration_035.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('eclipseprotocol', 'Eclipse Protocol', '🌃', 'Legend Pass', '#ff3ea5', 'Blade Runner tactical combat — a blade and a pulse pistol sharing one heat gauge.', 'eclipseprotocol', 'subscription', 'premium_plus', null, null, 320, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
