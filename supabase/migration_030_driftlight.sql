-- ============================================================
-- Migration: Driftlight — a sixth Legend Pass game, and the first
-- one where combat is secondary rather than the point. Built from a
-- production spec asking for "the most visually beautiful browser
-- game ever" (six biomes, wall-running, a grapple hook, a five-layer
-- adaptive orchestral music engine, photo mode) — honestly scoped
-- down to one continuous world with real acceleration-based
-- movement, coyote time, jump buffering, a double jump, a glide, and
-- a dash, plus a day-night sky cycle, three blended visual zones,
-- ambient particles, and a soft-glow player rendered without any
-- sprite grid at all. Original world/character names. Desktop-only,
-- fullscreen from the start, with the arrow-key scroll fix already
-- in place.
-- Run this once in Supabase SQL Editor after migration_029.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('driftlight', 'Driftlight', '✨', 'Legend Pass', '#3ee6e0', 'Movement and light over combat — glide, dash, and collect fragments through a drifting world.', 'driftlight', 'subscription', 'premium_plus', null, null, 270, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
