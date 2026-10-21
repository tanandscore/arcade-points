-- ============================================================
-- Migration: admin accounts
-- Run this once in Supabase SQL Editor after migration_003.
-- ============================================================

alter table public.profiles add column if not exists is_admin boolean not null default false;

-- After running this, make yourself an admin manually (this migration
-- can't know who you are): Table Editor -> profiles -> find your row
-- -> set is_admin to true -> save. From then on, that account plays
-- every game free and can access /admin to manage other users.
