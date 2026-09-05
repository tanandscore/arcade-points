-- ============================================================
-- Migration: the flagship tier above Power Pass (originally called
-- "Premium Plus" here — renamed to "Legend Pass" by migration_022,
-- and this file has been updated to match so a fresh run of the full
-- migration sequence lands in the correct final state without
-- needing migration_022 as a corrective patch). Existing Power Pass
-- subscribers do NOT get Legend Pass access automatically (different
-- plan_id, checked exactly by hasSubscriptionAccess) — this is a
-- deliberate, separate upsell.
-- Run this once in Supabase SQL Editor after migration_017.
-- ============================================================

insert into public.subscription_plans (id, name, price_paise, price_display, razorpay_plan_id, is_active)
values ('premium_plus', 'Legend Pass', 14900, '₹149', null, true)
on conflict (id) do update set
  name = excluded.name, price_paise = excluded.price_paise, price_display = excluded.price_display, is_active = excluded.is_active;

-- razorpay_plan_id is left null here — you'll need to create a
-- ₹149/month Plan in the Razorpay dashboard (same process as the
-- original Power Pass plan) and paste its plan_id in here:
-- update public.subscription_plans set razorpay_plan_id = 'plan_xxxxx' where id = 'premium_plus';

-- Titan Arena — the flagship Legend Pass title. An original full-3D
-- fighting game (not a clone of any existing commercial game — an
-- original roster of fighters, original names, original powers).
insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('titanarena', 'Titan Arena', '🥋', 'Legend Pass', '#ffb703', 'A full 3D fighting game. Choose your fighter, enter the arena.', 'titanarena', 'subscription', 'premium_plus', null, null, 200, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
