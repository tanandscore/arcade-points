-- ============================================================
-- Migration: Cloudflare Worker resource-limit hardening.
--
-- Two real, concrete patterns in the current code fetch an entire
-- table into the Worker's memory and process it in JavaScript,
-- rather than letting Postgres do the aggregation:
--
-- 1. getLeaderboardRows() (lib/leaderboard.js) had no LIMIT at all —
--    "overall" fetched every row in `scores` (every game, every
--    user) to sum per-user totals in JS; a per-game leaderboard
--    fetched every score for that game. At meaningful scale
--    (100k users x 100 games), this is exactly the shape of query
--    that exceeds a Worker's CPU/memory limits and produces error
--    1102 — not a theoretical risk, a direct read of the code.
--
--    Worse: app/leaderboard/page.js's "51st & beyond" display tier
--    used `end: Infinity` — meaning at 100k users, that page was
--    trying to render essentially the entire user base in one
--    response, independent of the query fix.
--
-- 2. The admin overview's DAU/WAU/MAU (lib/adminOverview.js) fetched
--    every activity_days row in the relevant date range just to
--    count distinct user_ids in JS.
--
-- Fixes: real SQL aggregation, computed and limited in Postgres,
-- returned already-joined with the profile fields the UI needs so
-- there's no second round-trip. A dedicated rank-lookup function
-- replaces "fetch everyone, find my position in JS" for the one
-- place that genuinely needs a single user's rank rather than a
-- top-N list.
-- Run this once in Supabase SQL Editor after migration_049.
-- ============================================================

-- The existing primary key on scores is (user_id, game) — it does
-- nothing for "WHERE game = X ORDER BY score DESC", which is exactly
-- what the per-game leaderboard needs.
create index if not exists scores_game_score_idx on public.scores (game, score desc);

create or replace function public.leaderboard_top(p_game text, p_limit int default 100)
returns table(user_id uuid, username text, country text, is_premium boolean, score integer)
language sql stable
as $$
  select s.user_id, p.username, p.country, p.is_premium, s.score
  from public.scores s
  join public.profiles p on p.id = s.user_id
  where s.game = p_game
  order by s.score desc
  limit p_limit;
$$;

create or replace function public.leaderboard_overall_top(p_limit int default 100)
returns table(user_id uuid, username text, country text, is_premium boolean, total bigint)
language sql stable
as $$
  select s.user_id, p.username, p.country, p.is_premium, sum(s.score) as total
  from public.scores s
  join public.profiles p on p.id = s.user_id
  group by s.user_id, p.username, p.country, p.is_premium
  order by total desc
  limit p_limit;
$$;

-- A single user's overall rank and total, computed entirely in
-- Postgres via a window function — replaces fetching every player's
-- total into the Worker just to find one index in a JS array.
create or replace function public.user_overall_rank(p_user_id uuid)
returns table(rnk bigint, total bigint)
language sql stable
as $$
  with totals as (
    select user_id, sum(score) as total
    from public.scores
    group by user_id
  ),
  ranked as (
    select user_id, total, rank() over (order by total desc) as rnk
    from totals
  )
  select rnk, total from ranked where user_id = p_user_id;
$$;

-- A single user's rank within one specific game's leaderboard — same
-- reasoning as user_overall_rank, needed because app/leaderboard/page.js
-- shows "your rank" even when you're well outside the displayed top
-- 100, for both the overall view and any single game.
create or replace function public.user_game_rank(p_user_id uuid, p_game text)
returns table(rnk bigint, score integer)
language sql stable
as $$
  with ranked as (
    select user_id, score, rank() over (order by score desc) as rnk
    from public.scores
    where game = p_game
  )
  select rnk, score from ranked where user_id = p_user_id;
$$;

grant execute on function public.user_game_rank(uuid, text) to authenticated;

grant execute on function public.leaderboard_top(text, int) to authenticated;
grant execute on function public.leaderboard_overall_top(int) to authenticated;
grant execute on function public.user_overall_rank(uuid) to authenticated;

-- Distinct-user counts for DAU/WAU/MAU, computed in Postgres instead
-- of fetching every activity_days row in range to build a JS Set.
create or replace function public.distinct_active_users(since_date date)
returns bigint
language sql stable
as $$
  select count(distinct user_id) from public.activity_days where activity_date >= since_date;
$$;

grant execute on function public.distinct_active_users(date) to authenticated;
