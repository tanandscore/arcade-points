-- ============================================================
-- Migration 090 (Upgrade 72): Stage 3 of the new game library.
--   Four new games go live:
--     Free:       Crate Courier, Garden Guards
--     Power Pass: Starline Vanguard, Ember Deck
--   Nothing else changes. Run migration 088 first (it creates the cloud-save table).
-- Paste ALL of this into Supabase > SQL Editor and click Run. It is safe to run again.
-- (The website already shows these games without this SQL; running it just keeps the database in agreement.)
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('gardenguards',     'Garden Guards',     '🌻', 'Strategy', '#8ae234', 'Plant your defenders along the lanes and stop the Gloom Gang.',                         'gardenguards',     'free',         null,      null, null, 26, true),
  ('cratecourier',     'Crate Courier',     '📦', 'Puzzle',   '#ff9d2e', 'Push every crate onto its glowing pad. Think before you shove.',                                'cratecourier',     'free',         null,      null, null, 27, true),
  ('starlinevanguard', 'Starline Vanguard', '🚀', 'Shooter',  '#38bdf8', 'Fly the last fighter of the Starline fleet through four sectors of enemy fire.',               'starlinevanguard', 'subscription', 'premium', null, null, 12, true),
  ('emberdeck',        'Ember Deck',        '🃏', 'Strategy', '#ff5d73', 'Build a deck of ember cards and fight your way up to the Ember Lord.',                          'emberdeck',        'subscription', 'premium', null, null, 13, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;

-- Quick check — should list the 4 flagships + the 12 new games, all active:
--   select slug, category, access_type, subscription_plan_id, is_active from public.games where is_active order by sort_order;
