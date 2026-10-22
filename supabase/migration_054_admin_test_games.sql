-- ============================================================
-- Migration: Admin-only game visibility ("upload new games to test
-- before rolling out").
--
-- Honest scope note: there's no way to literally "upload" a new
-- game's code at runtime in a compiled Next.js app — a new game is
-- always written and deployed as real code, the same way every
-- existing game was built this whole project. What this DOES enable
-- is the real equivalent of a staged rollout: a newly-coded game can
-- ship with admin_test_only = true, meaning it's fully live and
-- playable, but only reachable by an admin (via the hidden
-- /admin/game-testing listing, or its direct URL) — invisible to
-- every other visitor and excluded from the public game list — until
-- an admin flips it to false from the admin dashboard.
-- Run this once in Supabase SQL Editor after migration_053.
-- ============================================================

alter table public.games add column if not exists admin_test_only boolean not null default false;
