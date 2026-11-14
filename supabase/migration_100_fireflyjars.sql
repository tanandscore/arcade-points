-- Migration 100 (Upgrade 123): Firefly Jars (free 2D light puzzle) goes live. Safe to run again.
insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values ('fireflyjars', 'Firefly Jars', '🪲', 'Puzzle', '#ffd23f', 'Tap a jar. Wake every firefly.', 'fireflyjars', 'free', null, null, null, 28, true)
on conflict (slug) do update set name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color, tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type, sort_order = excluded.sort_order, is_active = excluded.is_active;
