-- ============================================================
-- Migration: the Midnight Burn map is now called "Mumbai Drift" (it used to be called "Mumbai 2046" on the game card).
-- Safe to run more than once. Run once in the Supabase SQL Editor after migration_076.
-- ============================================================
update public.games
set tagline = 'Mumbai Drift: a free-roam night city with metro trains, two airports, festival seasons, a ten-driver ladder and your dream build.'
where slug = 'midnightburn';
