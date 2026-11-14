-- ============================================================
-- Migration: Fix foreign keys that would block account deletion.
--
-- Found while building self-service account deletion, before
-- shipping it broken: three foreign keys reference auth.users (or
-- profiles) with no ON DELETE behavior specified at all, which means
-- Postgres defaults to blocking the delete outright (NO ACTION) if
-- any other row still points at the user being deleted.
--
-- profiles.referred_by is the one that actually matters for regular
-- users: ANY user who successfully referred a friend would have had
-- their own account-deletion request fail with a foreign key
-- violation, since the referred friend's profile still points back
-- at them. Fixed with ON DELETE SET NULL — the referred user's own
-- account and history are untouched; only the now-meaningless link
-- to a deleted referrer is cleared.
--
-- tournaments.created_by and changelog_entries.created_by are
-- admin-only actions in practice, but fixed the same way for
-- completeness and consistency, rather than leaving a real gap on
-- the theory it's unlikely to be hit: the tournament or changelog
-- entry itself stays intact, only the "created by" link clears.
--
-- Constraint names are discovered dynamically below via pg_constraint
-- rather than assumed from Postgres's usual auto-naming convention —
-- safer given this can't be tested against the live database before
-- running: if the assumed name were ever wrong, DROP CONSTRAINT IF
-- EXISTS would silently no-op while ADD CONSTRAINT with a
-- newly-invented name could still succeed, leaving the real,
-- original constraint (under its actual name) still in place and
-- still blocking deletes — the exact failure mode this migration
-- exists to fix. Querying pg_constraint for the real name first
-- removes that risk entirely.
--
-- Run this once in Supabase SQL Editor after migration_064.
-- ============================================================

do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and confrelid = 'public.profiles'::regclass
    and pg_get_constraintdef(oid) like '%referred_by%';
  if fk_name is not null then
    execute format('alter table public.profiles drop constraint %I', fk_name);
  end if;
  alter table public.profiles add constraint profiles_referred_by_fkey
    foreign key (referred_by) references public.profiles(id) on delete set null;

  select conname into fk_name
  from pg_constraint
  where conrelid = 'public.tournaments'::regclass
    and confrelid = 'auth.users'::regclass
    and pg_get_constraintdef(oid) like '%created_by%';
  if fk_name is not null then
    execute format('alter table public.tournaments drop constraint %I', fk_name);
  end if;
  alter table public.tournaments add constraint tournaments_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

  select conname into fk_name
  from pg_constraint
  where conrelid = 'public.changelog_entries'::regclass
    and confrelid = 'auth.users'::regclass
    and pg_get_constraintdef(oid) like '%created_by%';
  if fk_name is not null then
    execute format('alter table public.changelog_entries drop constraint %I', fk_name);
  end if;
  alter table public.changelog_entries add constraint changelog_entries_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;
end $$;
