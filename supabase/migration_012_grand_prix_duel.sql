-- ============================================================
-- Migration: Grand Prix Duel - live multiplayer racing
-- Run this once in Supabase SQL Editor after migration_011.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('grandprixduel', 'Grand Prix Duel', '🏁', 'Premium', '#ff5a3c', 'Live 1v1 racing — a real opponent, real time, real track.', 'grandprixduel', 'subscription', 'premium', null, null, 158, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;

-- No new tables needed — Grand Prix Duel reuses the same `duels` table
-- purely for matchmaking (finding an opponent, marking a match
-- active). Once a race starts, live car positions travel over
-- Supabase Realtime's ephemeral Broadcast channels, not the database,
-- so there's nothing further to migrate for the actual racing.
