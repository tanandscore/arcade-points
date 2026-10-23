-- ============================================================
-- Migration: Launch countdown fields.
--
-- launch_countdown_at: when gameplay unlocks (null = no countdown
-- active, i.e. gameplay is already open). Browsing, account
-- creation, and leaderboards stay available regardless — this only
-- gates actually playing a game, enforced in app/games/[slug]/page.js.
-- launch_countdown_label: shown next to the countdown wherever it
-- renders ("Grand Launch", a tournament name, etc.), admin-editable.
-- Run this once in Supabase SQL Editor after migration_054.
-- ============================================================

alter table public.site_settings add column if not exists launch_countdown_at timestamptz;
alter table public.site_settings add column if not exists launch_countdown_label text not null default 'Launch';
