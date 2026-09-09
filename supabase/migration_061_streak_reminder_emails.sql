-- ============================================================
-- Migration: Streak-protection reminder emails — opt-out column.
--
-- Adds a single boolean so a user can turn off streak-reminder
-- emails without needing a broader "email preferences" system that
-- doesn't otherwise exist yet. Defaults to false (opted in) since
-- the reminder only ever fires for a user who already has a real,
-- active streak going — it's protecting something they've already
-- built, not cold marketing outreach to someone who's never played.
-- The account page surfaces a real toggle for this (see
-- app/account/page.js and app/api/account/streak-email/route.js),
-- so opting out is always one click away, not just a schema field
-- nobody can actually reach.
--
-- Run this once in Supabase SQL Editor after migration_060.
-- ============================================================

alter table public.profiles add column if not exists streak_email_opt_out boolean not null default false;
