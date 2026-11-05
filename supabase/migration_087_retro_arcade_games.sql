-- Upgrade 59: six new FREE retro arcade games. Run once in the Supabase SQL editor. Safe to re-run.
insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, price_paise, price_display, sort_order, is_active)
values
  ('neonpong', 'Neon Pong', '🏓', 'Arcade', '#3ee6e0', 'The 70s classic. Beat the computer, it gets faster.', 'neonpong', 'free', null, null, 142, true),
  ('roadhopper', 'Road Hopper', '🐸', 'Arcade', '#6fe26f', 'Dodge the traffic, ride the logs, reach the far bank.', 'roadhopper', 'free', null, null, 144, true),
  ('minefield', 'Minefield', '💣', 'Puzzle', '#ffb703', 'The classic number puzzle. Clear the board, mind the mines.', 'minefield', 'free', null, null, 146, true),
  ('duckshoot', 'Duck Shoot', '🦆', 'Shooter', '#58b8ff', 'Three shots, two ducks. Don''t let them escape.', 'duckshoot', 'free', null, null, 148, true),
  ('galaxystrike', 'Galaxy Strike', '🛸', 'Arcade', '#ff3ea5', 'Aliens swoop and dive. Steer, dodge, clear the wave.', 'galaxystrike', 'free', null, null, 150, true),
  ('bubblepop', 'Bubble Pop', '🫧', 'Puzzle', '#b6ff3e', 'Aim, match three, drop the hanging bubbles.', 'bubblepop', 'free', null, null, 152, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  price_paise = excluded.price_paise, price_display = excluded.price_display, sort_order = excluded.sort_order, is_active = excluded.is_active;
