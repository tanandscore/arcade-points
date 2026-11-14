-- Migration 099 (Upgrade 122): Threefold (free 3D puzzle platformer) goes live. Safe to run again.
insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values ('threefold', 'Threefold', '🛡️', 'Puzzle', '#ffd24a', 'Swap between a Warden, a Wisp and an Archer to solve physics puzzles. Full 3D.', 'threefold', 'free', null, null, null, 11, true)
on conflict (slug) do update set name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color, tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type, sort_order = excluded.sort_order, is_active = excluded.is_active;
