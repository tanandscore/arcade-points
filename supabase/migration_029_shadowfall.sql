-- ============================================================
-- Migration: Shadowfall — a fifth Legend Pass game, and genuinely a
-- different GENRE from the four survival games, not just a
-- reskin: a real 2D platformer with gravity, jumping, a camera that
-- scrolls through a world bigger than the screen, manual
-- player-directed melee combat, and ability-gated exploration (find
-- Double Jump to cross a chasm you couldn't reach before). Original
-- world/character/enemy names, inspired by — not a reproduction
-- of — the metroidvania genre's atmosphere and pacing. Desktop-only,
-- fullscreen from the start.
-- Run this once in Supabase SQL Editor after migration_028.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('shadowfall', 'Shadowfall', '🌑', 'Legend Pass', '#3ee6e0', 'A real platformer, not another arena — explore, unlock Double Jump, face the Hollow Warden.', 'shadowfall', 'subscription', 'premium_plus', null, null, 260, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
