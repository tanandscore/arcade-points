-- ============================================================
-- Migration: Public Profile Page (Phase 4) — one new column.
--
-- The live "current streak" was already computable on demand from
-- activity_days (see lib/achievements.js), but nothing remembered
-- the PEAK streak once it ended — a player who had a 45-day streak
-- months ago and stopped would show a current streak of 0 with no
-- record that the 45 ever happened. longest_streak is updated
-- alongside the existing achievement/XP check whenever the live
-- current streak exceeds what's stored.
-- Run this once in Supabase SQL Editor after migration_042.
-- ============================================================

alter table public.profiles add column if not exists longest_streak int not null default 0;

-- Same reasoning as increment_lifetime_points / increment_platform_xp:
-- profiles deliberately has no UPDATE policy for regular users (to
-- prevent RLS from also letting someone flip is_admin on themselves),
-- so this write needs its own SECURITY DEFINER RPC rather than a
-- direct .update() call from the user's own session. GREATEST()
-- inside the function also makes the "only update if higher" check
-- atomic, instead of a separate read-then-write that could race.
create or replace function public.update_longest_streak(p_user_id uuid, p_streak integer)
returns void as $$
begin
  update public.profiles
  set longest_streak = greatest(longest_streak, p_streak)
  where id = p_user_id;
end;
$$ language plpgsql security definer;

grant execute on function public.update_longest_streak(uuid, integer) to authenticated;
