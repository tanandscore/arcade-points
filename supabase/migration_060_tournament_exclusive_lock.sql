-- ============================================================
-- Migration: adds admin control over whether a tournament's games
-- are locked to tournament-only play. When true and the tournament
-- is live, its games become unplayable from the normal dashboard —
-- only reachable via the "Play Now" link on the tournament page
-- itself, which is what actually grants entry (see the game page's
-- own check for how this is enforced).
-- Defaults to false so every existing tournament keeps working
-- exactly as before until an admin explicitly opts a tournament in.
-- Run this once in Supabase SQL Editor after migration_059.
-- ============================================================

alter table public.tournaments
  add column if not exists require_tournament_entry boolean not null default false;
