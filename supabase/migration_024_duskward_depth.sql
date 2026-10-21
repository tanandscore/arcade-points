-- ============================================================
-- Migration: adds a stamina resource to Duskward characters, used
-- by the new skill system (Power Strike, Second Wind) — real combat
-- decisions beyond "click attack repeatedly," which was the biggest
-- gap in the first version. Only adds new columns with safe
-- defaults — doesn't touch any existing character data.
-- Run this once in Supabase SQL Editor after migration_023.
-- ============================================================

alter table public.rpg_characters add column if not exists stamina int not null default 20;
alter table public.rpg_characters add column if not exists max_stamina int not null default 20;
