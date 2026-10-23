-- ============================================================
-- Migration 079 — "Most Played Games" now updates by itself.
--
-- WHY: the old list downloaded the whole `scores` table and counted it
-- in JavaScript. The database only ever hands back its first 1,000 rows,
-- so once the site passed 1,000 saved scores the ranking froze — new
-- plays stopped moving it.
--
-- WHAT THIS ADDS:
--   * game_plays        — one running counter per game ("how many times
--                         has this game been played to the end").
--   * record_game_play  — adds 1 to a game's counter. The score route
--                         calls it every time anyone finishes a game.
--   * game_play_totals  — returns each game's plays AND how many different
--                         players have tried it, for the leaderboard list.
--
-- Existing history: every game starts with a count equal to the number of
-- different players who already played it (from `last_played`) — an honest
-- minimum, since exact old play counts were never recorded.
--
-- Run once in the Supabase SQL Editor (after migration_078). Safe to
-- run twice. If you skip it, the site still works: the leaderboard falls
-- back to counting players with the older game_player_counts function.
-- ============================================================

create table if not exists public.game_plays (
  game text primary key,
  plays bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.game_plays enable row level security;
-- (no policies on purpose: the table is only touched through the two
--  functions below, which run with the owner's rights)

insert into public.game_plays (game, plays)
select game, count(distinct user_id) from public.last_played group by game
on conflict (game) do nothing;

create or replace function public.record_game_play(p_game text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.game_plays (game, plays, updated_at)
  values (p_game, 1, now())
  on conflict (game) do update
    set plays = public.game_plays.plays + 1, updated_at = now();
$$;

create or replace function public.game_play_totals()
returns table(game text, plays bigint, players bigint)
language sql
stable
security definer
set search_path = public
as $$
  select g.game,
         g.plays,
         coalesce((select count(distinct lp.user_id) from public.last_played lp where lp.game = g.game), 0) as players
  from public.game_plays g
  order by g.plays desc;
$$;

grant execute on function public.record_game_play(text) to authenticated;
grant execute on function public.game_play_totals() to authenticated, anon, service_role;
