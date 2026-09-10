-- ============================================================
-- Migration: Activity Feed (Phase 5) — one new append-only table,
-- one new opt-out column.
--
-- RLS design: SELECT is open to any authenticated user (this is a
-- site-wide feed, meant to be seen — the same openness leaderboards
-- already have, not a new category of exposure). Privacy is handled
-- at WRITE time instead: an event is simply never inserted for a
-- user who has opted out via activity_visible. That means toggling
-- the setting off doesn't retroactively scrub past events already in
-- the feed — an intentional, simple tradeoff (consistent with how
-- most platforms handle this), not an oversight.
--
-- Only usernames and event types are ever shown — no raw scores, no
-- game details beyond which game, nothing that isn't already
-- treated as showable elsewhere on the site (achievements,
-- leaderboard position).
-- Run this once in Supabase SQL Editor after migration_043.
-- ============================================================

alter table public.profiles add column if not exists activity_visible boolean not null default true;

create table if not exists public.activity_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null, -- 'new_best' | 'achievement' | 'hall_of_fame' | 'duel_win' | 'level_up'
  game text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.activity_events enable row level security;

create policy "Any signed-in user can view the activity feed" on public.activity_events
  for select using (auth.uid() is not null);

create policy "Users can insert own activity events" on public.activity_events
  for insert with check (auth.uid() = user_id);

create index if not exists activity_events_created_at_idx on public.activity_events (created_at desc);
