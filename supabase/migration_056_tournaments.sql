-- ============================================================
-- Migration: Tournament system.
--
-- Real architectural note, not glossed over: difficulty_scores only
-- ever stores each player's all-time best per game (upserted in
-- place, primary key user_id+game+difficulty) — it has no per-session
-- history. Building a tournament leaderboard directly off that table
-- would silently exclude anyone whose all-time best was set before
-- the tournament started, even if they play during it — which would
-- make the leaderboard look empty/broken for exactly the players a
-- tournament is for. tournament_scores exists specifically to track
-- each player's best score DURING a given tournament's window,
-- independent of their all-time best. See app/api/difficulty-scores/
-- route.js for where this actually gets written on every submission.
--
-- Two game types genuinely exist here, and this schema doesn't
-- pretend otherwise: score-based games (most games, including both
-- flagship games) rank by tournament_scores; the two real multiplayer
-- games (GrandPrixDuel, TerritoryDuel) rank by win count from the
-- existing duels table, filtered to the tournament's date range —
-- computed at read time in lib/tournaments.js, no new table needed
-- for those since duels already has everything required.
-- Run this once in Supabase SQL Editor after migration_055.
-- ============================================================

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  game_slugs text[] not null default '{}',
  announcement text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.tournaments enable row level security;

create policy "Anyone can view tournaments" on public.tournaments
  for select using (true);
-- No insert/update/delete policy for regular users — tournaments are
-- only ever created/edited through app/api/admin/tournaments/route.js,
-- which uses the service-role client and bypasses RLS entirely.

create table if not exists public.tournament_scores (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null,
  best_score int not null default 0,
  achieved_at timestamptz not null default now(),
  primary key (tournament_id, user_id, game)
);

alter table public.tournament_scores enable row level security;

create policy "Anyone can view tournament scores" on public.tournament_scores
  for select using (true);

create policy "Users can insert own tournament scores" on public.tournament_scores
  for insert with check (auth.uid() = user_id);

create policy "Users can update own tournament scores" on public.tournament_scores
  for update using (auth.uid() = user_id);

create index if not exists tournament_scores_leaderboard_idx on public.tournament_scores (tournament_id, game, best_score desc);
