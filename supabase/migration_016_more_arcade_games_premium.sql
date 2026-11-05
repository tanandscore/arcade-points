-- ============================================================
-- Migration: 5 more classic-arcade-inspired games + moving the
-- whole 8-game batch (this migration's + migration_015's games) to
-- Premium, per explicit request — these are no longer free.
-- Run this once in Supabase SQL Editor after migration_015.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('skyraiders', 'Sky Raiders', '🦋', 'Premium', '#3ee6e0', 'A formation holds above — until it doesn''t.', 'skyraiders', 'subscription', 'premium', null, null, 160, true),
  ('peakascent', 'Peak Ascent', '🧗', 'Premium', '#ffb703', 'Climb as high as you can. Dodge every barrel.', 'peakascent', 'subscription', 'premium', null, null, 162, true),
  ('horizonguardian', 'Horizon Guardian', '🚁', 'Premium', '#ff3ea5', 'Defend the colonists. Rescue whoever gets taken.', 'horizonguardian', 'subscription', 'premium', null, null, 164, true),
  ('duelarena', 'Duel Arena', '🥋', 'Premium', '#ff5a3c', 'Best of 3. Close the distance, then strike.', 'duelarena', 'subscription', 'premium', null, null, 166, true),
  ('frontlinemarksman', 'Frontline Marksman', '🎯', 'Premium', '#a99fd6', 'Expose, shoot, take cover. Reload before you''re empty.', 'frontlinemarksman', 'subscription', 'premium', null, null, 168, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;

-- Moves the 3 games added in migration_015 (built for the same
-- request as this batch) from Free/Arcade to Premium.
update public.games
set access_type = 'subscription', subscription_plan_id = 'premium', category = 'Premium', price_paise = null, price_display = null
where slug in ('stardefender', 'voiddrifter', 'swarmbreach');
