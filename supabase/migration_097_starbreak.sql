-- Migration 097 (Upgrade 116): Starbreak (free 3D space-rebels game) goes live. Safe to run again.
insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values ('starbreak', 'Starbreak', '🚀', 'Action', '#ff7a3a', 'Fly a rebel starfighter, run the station trench and duel with an energy blade. Full 3D.', 'starbreak', 'free', null, null, null, 9, true)
on conflict (slug) do update set name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color, tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type, sort_order = excluded.sort_order, is_active = excluded.is_active;
