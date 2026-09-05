-- ============================================================
-- Migration: Eternal Frontier — a fourteenth Legend Pass game, and
-- the deliberately scoped-down version of a "flagship RPG" spec that
-- described 8 regions, 12 bosses, and weeks of development time. A
-- hub settlement you return to between expeditions (using Celestial
-- Dreams' real ctx.filter grayscale-restoration technique — the
-- settlement genuinely regains color as regions are cleared, tying
-- the whole meta-game together visually), 3 distinct original
-- regions (The Verdant Hush, The Shattered Spire, The Ember Wastes),
-- and one genuine spectacle two-phase boss per region, reusing
-- Shadowfall's platformer physics and Emberlight's arc-swing combat
-- and dash rather than reinventing everything under an already
-- enormous scope. Original names throughout. Desktop-only,
-- fullscreen, arrow-key scroll fix included from the first line.
-- Run this once in Supabase SQL Editor after migration_038.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('eternalfrontier', 'Eternal Frontier', '🏔️', 'Legend Pass', '#ffb703', 'A ruined settlement, three fading regions, and a guardian to fell in each.', 'eternalfrontier', 'subscription', 'premium_plus', null, null, 350, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
