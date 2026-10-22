-- ============================================================
-- Migration: Wrath of Olympus — a third flagship, and a genuine
-- pace/genre change from the other two: not a mouse-aimed shooter
-- (Operation Blacksite), not a calm builder (Kingdoms of Ash), but a
-- commander-perspective temple defense. The player never directly
-- controls a unit's movement or aim — auto-fighting Champions handle
-- melee on their own, and the player's real actions are choosing
-- where and when to cast a small set of genuinely different, working
-- divine powers (a lightning strike, a knockback wave, a war-fury
-- buff) against escalating waves of mythological beasts marching on
-- the temple. Built as a real, focused game — not the full pantheon/
-- RTS/unit-pathing spec originally proposed, which would have taken
-- an entirely different engine to build honestly.
-- Run this once in Supabase SQL Editor after migration_057.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('wrathofolympus', 'Wrath of Olympus', '⚡', 'Legend Pass', '#ffd23f', 'Command divine powers to defend your temple from waves of mythological beasts.', 'wrathofolympus', 'subscription', 'premium_plus', null, null, 310, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
