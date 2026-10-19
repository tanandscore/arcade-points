-- ============================================================
-- Migration: Continue Playing + Trending (Phase 3) — one new,
-- bounded table.
--
-- Why a new table at all: scores.updated_at only changes on a NEW
-- personal best (see /api/scores) — playing a game again without
-- beating your record leaves it untouched. That's the right
-- behavior for a leaderboard timestamp, but wrong for "last played,"
-- which needs to update on every session regardless of score.
--
-- Why upsert-by-(user_id, game) instead of an append-only log: this
-- keeps the table bounded at (users × games each has played), not
-- growing forever by one row per session. That's enough for both
-- features this migration exists for:
--   - Continue Playing: order by played_at desc for one user.
--   - Trending This Week: count distinct users per game where
--     played_at fell in the last 7 days — an honest "how many
--     different players engaged with this recently" signal, not a
--     raw session-count (which would need the unbounded version and
--     isn't worth the storage tradeoff for what it'd add).
-- Run this once in Supabase SQL Editor after migration_041.
-- ============================================================

create table if not exists public.last_played (
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null,
  played_at timestamptz not null default now(),
  primary key (user_id, game)
);

alter table public.last_played enable row level security;

create policy "Users can view own last_played" on public.last_played
  for select using (auth.uid() = user_id);

create policy "Users can upsert own last_played" on public.last_played
  for insert with check (auth.uid() = user_id);

create policy "Users can update own last_played" on public.last_played
  for update using (auth.uid() = user_id);

-- Trending needs to count distinct players across ALL users per game,
-- which a single user's RLS-scoped client can't see — same pattern as
-- achievements' global completion %, handled the same way: a narrow
-- server route using the service-role client to aggregate counts
-- only, never exposing which specific other users played what.
