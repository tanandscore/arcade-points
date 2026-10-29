-- ============================================================
-- Migration 089 (Upgrade 71): Stage 2 of the new game library.
--   Five new games go live:
--     Free:       Gem Garden, Blast Grid, Putt Planet, Snip & Drop
--     Power Pass: Hollow Deep
--   Nothing else changes. Run migration 088 first (it creates the cloud-save table).
-- Paste ALL of this into Supabase > SQL Editor and click Run. It is safe to run again.
-- (The website already shows these games without this SQL; running it just keeps the database in agreement.)
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('puttplanet', 'Putt Planet',  '⛳', 'Sports',  '#3ee6e0', 'Mini golf across the planets: bank it, boost it, bend it round a gas giant.',                       'puttplanet', 'free',         null,      null, null, 22, true),
  ('gemgarden',  'Gem Garden',   '💎', 'Puzzle',  '#c06bff', 'Swap, match and blast your way through four sparkling gardens.',                                      'gemgarden',  'free',         null,      null, null, 23, true),
  ('snipdrop',   'Snip & Drop',  '✂️', 'Physics', '#4fd1ff', 'Snip the ropes in the right order and guide the glowing berry to a hungry critter.',                   'snipdrop',   'free',         null,      null, null, 24, true),
  ('blastgrid',  'Blast Grid',   '💣', 'Puzzle',  '#ff5a5a', 'Drop bombs, break crates and outsmart the bots.',                                                      'blastgrid',  'free',         null,      null, null, 25, true),
  ('hollowdeep', 'Hollow Deep',  '🗡️', 'Action',  '#8f7bff', 'Swing, dash and deflect your way down four depths to four bosses.',                                    'hollowdeep', 'subscription', 'premium', null, null, 11, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;

-- Quick check — should list the 4 flagships + the 8 new games, all active:
--   select slug, category, access_type, subscription_plan_id, is_active from public.games where is_active order by sort_order;
