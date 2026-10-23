-- ============================================================
-- Migration: a new, separate table for per-difficulty best scores —
-- deliberately NOT a change to the existing `scores` table (which
-- every one of the 54 games on the site depends on with a simple
-- one-row-per-user-per-game shape). Altering that table's primary
-- key to add a difficulty dimension would be real risk for zero
-- benefit to the 52 games that don't have difficulty tiers. This new
-- table is additive and only touched by games that opt into it.
--
-- Note: no DROP POLICY lines here on purpose — this table is new,
-- so there's nothing to drop, and Supabase's SQL editor flags DROP
-- statements as "destructive" even when harmless. Nothing here
-- touches any existing table or data.
-- Run this once in Supabase SQL Editor after migration_034.
-- ============================================================

create table if not exists public.difficulty_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null,
  difficulty text not null,
  score int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, game, difficulty)
);

alter table public.difficulty_scores enable row level security;

create policy "Users can view own difficulty scores" on public.difficulty_scores
  for select using (auth.uid() = user_id);

create policy "Users can insert own difficulty scores" on public.difficulty_scores
  for insert with check (auth.uid() = user_id);

create policy "Users can update own difficulty scores" on public.difficulty_scores
  for update using (auth.uid() = user_id);
