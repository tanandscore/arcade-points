-- ============================================================
-- Migration: Celestial Dreams — a thirteenth Legend Pass game, and
-- the purest "beauty over mechanics" title on the site: no combat,
-- no health bar, no threat at all. Three genuinely distinct
-- sequential biomes (not blended like Driftlight) — The Grey Dunes,
-- The Drowned Vale, The Aurora Peaks. The signature mechanic is a
-- real Gris-style color restoration: the whole scene is desaturated
-- using Canvas's actual ctx.filter grayscale support (not a fake
-- tint layer) and genuinely regains color and saturation as Ancient
-- Blooms are restored. A scarf-glide with a real limited energy
-- meter (Journey's signature mechanic, refilled at glowing Song
-- Stones) replaces Driftlight's unlimited glide. First game on the
-- site with water reflections and an aurora sky. Built from a spec
-- asking for "infinite atmospheric effects" and a full adaptive
-- orchestral score — scoped honestly to what's actually achievable
-- in Canvas + WebAudio without a new music engine. Desktop-only,
-- fullscreen, arrow-key scroll fix included.
-- Run this once in Supabase SQL Editor after migration_037.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('celestialdreams', 'Celestial Dreams', '🌅', 'Legend Pass', '#ffe9b8', 'No combat, no threat — walk through three fading lands and return their color.', 'celestialdreams', 'subscription', 'premium_plus', null, null, 340, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
