-- ============================================================
-- Migration: adds admin control over which past tournaments appear
-- in the public "Past Winners" list on /tournaments. Full deletion
-- of a tournament already existed (DELETE /api/admin/tournaments/[id]);
-- this is the softer option — hide a result from the public list
-- without destroying its underlying data (standings, scores, etc.),
-- since an admin may want to keep the record without publicizing it.
-- Defaults to true so every existing tournament keeps showing until
-- an admin explicitly hides one.
-- Run this once in Supabase SQL Editor after migration_058.
-- ============================================================

alter table public.tournaments
  add column if not exists show_in_winners_list boolean not null default true;
