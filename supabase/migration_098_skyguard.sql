-- Migration 098 (Upgrade 121): Skyguard (free 3D superhero game) goes live. Safe to run again.
insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values ('skyguard', 'Skyguard', '🦅', 'Action', '#4aa3ff', 'Fly over a glowing city, stop getaway cars and fight giant robots in the street. Full 3D.', 'skyguard', 'free', null, null, null, 10, true)
on conflict (slug) do update set name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color, tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type, sort_order = excluded.sort_order, is_active = excluded.is_active;
