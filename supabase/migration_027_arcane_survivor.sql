-- ============================================================
-- Migration: Arcane Survivor — a third horde-survival roguelite for
-- Legend Pass. Genuinely differentiated from the previous two: up to
-- 3 simultaneous weapons instead of one, rarity-tiered upgrade cards
-- (Common/Rare/Epic/Legendary), a weapon evolution (Arcane Bolt →
-- Arcane Nova), elite enemy variants, and a boss with a real phase
-- transition at half health. Desktop-only, opens in fullscreen, same
-- as the rest of Legend Pass. Original theme/roster — not a
-- reproduction of any existing commercial game.
-- Run this once in Supabase SQL Editor after migration_026.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('arcanesurvivor', 'Arcane Survivor', '🔮', 'Legend Pass', '#3ee6e0', 'Three weapons, rarity-tiered upgrades, and a boss with a real second phase.', 'arcanesurvivor', 'subscription', 'premium_plus', null, null, 240, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
