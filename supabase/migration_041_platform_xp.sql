-- ============================================================
-- Migration: Platform XP (Phase 2 of the platform architecture) —
-- one new column, one atomic RPC mirroring increment_lifetime_points
-- exactly (same reasoning applies: concurrent score submissions from
-- multiple tabs shouldn't be able to clobber each other's XP via a
-- read-then-write race).
--
-- Level is deliberately NOT stored anywhere — it's computed from
-- platform_xp on read (see lib/xp.js), so changing the leveling
-- curve later never needs a data migration or backfill.
-- Run this once in Supabase SQL Editor after migration_040.
-- ============================================================

alter table public.profiles add column if not exists platform_xp bigint not null default 0;

create or replace function public.increment_platform_xp(p_user_id uuid, p_amount integer)
returns void as $$
begin
  update public.profiles
  set platform_xp = platform_xp + greatest(p_amount, 0)
  where id = p_user_id;
end;
$$ language plpgsql security definer;

grant execute on function public.increment_platform_xp(uuid, integer) to authenticated;
