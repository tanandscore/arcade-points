-- ============================================================
-- Migration: on/off switch for Operation Blacksite multiplayer.
-- OFF (default): shows "Coming soon" to players; admins can still test it.
-- ON: every signed-in player can create/join online rooms.
-- Flip it from Admin -> Site settings. Run once in the Supabase SQL Editor.
-- ============================================================
alter table public.site_settings
  add column if not exists blacksite_mp_open boolean not null default false;
