-- Migration 095 (Upgrade 114): Tiptoe (free stealth escape) goes live. Safe to run again.
insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values ('tiptoe', 'Tiptoe', '🧥', 'Adventure', '#f2c230', 'A very small kid in a very big house. Stay quiet. Stay hidden. Find the front door.', 'tiptoe', 'free', null, null, null, 32, true)
on conflict (slug) do update set name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color, tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type, sort_order = excluded.sort_order, is_active = excluded.is_active;
