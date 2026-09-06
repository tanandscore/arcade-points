-- ============================================================
-- Migration: Performance — replace "fetch every last_played row,
-- count distinct players in JavaScript" with a real SQL aggregation.
--
-- Before this migration, getTrendingGames, getHiddenGems, and the
-- admin overview's top-games list each pulled potentially the ENTIRE
-- last_played table into the Node.js runtime — fine today, but
-- exactly the pattern that breaks as the table grows toward
-- millions of rows, since every row has to cross the network and
-- get counted client-side instead of being aggregated where the
-- data already lives. Two of those four call sites were unbounded,
-- all-time, full-table scans with no date filter at all.
--
-- game_player_counts(since) does the counting in Postgres, with a
-- single function serving all four use cases (all-time, this-week,
-- today) by varying the `since` parameter. The primary key on
-- last_played is (user_id, game), which does nothing for a
-- "WHERE played_at >= X GROUP BY game" query — so this migration
-- also adds the index that actually serves it, rather than relying
-- on one that doesn't exist.
-- Run this once in Supabase SQL Editor after migration_046.
-- ============================================================

create index if not exists last_played_played_at_idx on public.last_played (played_at desc);

-- Same reasoning for activity_days: its primary key leads with
-- user_id, which does nothing for the DAU/WAU/MAU queries that
-- filter activity_date across every user (see lib/adminOverview.js) —
-- those currently can't use the primary key at all for that filter.
create index if not exists activity_days_activity_date_idx on public.activity_days (activity_date);

create or replace function public.game_player_counts(since timestamptz default null)
returns table(game text, player_count bigint)
language sql
stable
as $$
  select game, count(distinct user_id) as player_count
  from public.last_played
  where since is null or played_at >= since
  group by game;
$$;

grant execute on function public.game_player_counts(timestamptz) to authenticated;
