-- ============================================================
-- Migration: country + lifetime points (Hall of Fame)
-- Run this once in Supabase SQL Editor after migration_005.
-- ============================================================

alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists lifetime_points bigint not null default 0;

-- Deliberately NO update policy is added for profiles here. Letting
-- users freely update their own profile row via RLS would also let
-- them flip is_admin on themselves (RLS is row-level, not
-- column-level) — a serious privilege-escalation hole. Instead,
-- profile self-edits (username, country) and lifetime point awards
-- go through server routes using the service-role key, which
-- explicitly choose which columns to touch. See /api/account and
-- /api/scores.

-- Atomic increment for lifetime points — used instead of a plain
-- read-then-write update so concurrent score submissions (e.g. two
-- browser tabs) can't silently overwrite each other's points.
create or replace function public.increment_lifetime_points(p_user_id uuid, p_amount integer)
returns void as $$
begin
  update public.profiles
  set lifetime_points = lifetime_points + greatest(p_amount, 0)
  where id = p_user_id;
end;
$$ language plpgsql security definer;

-- Explicit grant so the increment function works when called through
-- the normal (RLS-respecting) client — SECURITY DEFINER makes the
-- function itself bypass RLS internally, but Postgres still needs
-- EXECUTE permission granted to actually call it.
grant execute on function public.increment_lifetime_points(uuid, integer) to authenticated;

-- Extend the existing signup trigger so it also captures country
-- (passed as signup metadata) alongside username.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, country)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'country'
  );
  return new;
end;
$$ language plpgsql security definer;
