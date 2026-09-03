-- ============================================================
-- Migration: Site settings — maintenance mode.
--
-- A singleton row (id always 1), same pattern as beta_program.
-- Enforced in middleware.js, which already runs on every request —
-- non-admin visitors get redirected to /maintenance while it's on;
-- admins can still reach the whole site, specifically so they can
-- turn it back off without needing separate emergency access.
-- Run this once in Supabase SQL Editor after migration_052.
-- ============================================================

create table if not exists public.site_settings (
  id int primary key default 1,
  maintenance_mode boolean not null default false,
  maintenance_message text not null default 'Game engine updating — we''ll be shortly back.',
  constraint site_settings_singleton check (id = 1)
);

insert into public.site_settings (id) values (1)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

create policy "Anyone can view site settings" on public.site_settings
  for select using (true);
