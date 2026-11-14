-- ============================================================
-- Migration 091 (Upgrade 110): two new free games go live: Hushwell and Bramble Rush.
-- Paste ALL of this into Supabase > SQL Editor and click Run. It is safe to run again.
-- (The website already shows these games without this SQL; running it keeps the leaderboard database in agreement.)
-- ============================================================
insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('hushwell',    'Hushwell',     '🔦', 'Puzzle',     '#ff6b6b', 'A quiet little kid. A very big, very silent building. Find out what is humming at the bottom.', 'hushwell',    'free', null, null, null, 30, true),
  ('bramblerush', 'Bramble Rush', '🦊', 'Platformer', '#ff9a3c', 'A fast, bouncy jungle run. Stomp, roll and spring your way through twelve long levels.',       'bramblerush', 'free', null, null, null, 31, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type, sort_order = excluded.sort_order, is_active = excluded.is_active;
