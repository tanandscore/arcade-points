-- ============================================================
-- Migration: Daily Challenges (Phase 7) — streak display needs no
-- new schema (currentStreakDays and longest_streak already exist
-- from Phases 2/4), just surfacing it. Daily challenges need one
-- small table to record completions, so a challenge is awarded once
-- per day, not re-awarded on every subsequent qualifying action.
-- Run this once in Supabase SQL Editor after migration_044.
-- ============================================================

create table if not exists public.daily_challenge_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id text not null,
  completed_date date not null,
  primary key (user_id, challenge_id, completed_date)
);

alter table public.daily_challenge_completions enable row level security;

create policy "Users can view own daily challenge completions" on public.daily_challenge_completions
  for select using (auth.uid() = user_id);

create policy "Users can insert own daily challenge completions" on public.daily_challenge_completions
  for insert with check (auth.uid() = user_id);
