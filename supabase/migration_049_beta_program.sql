-- ============================================================
-- Migration: Beta Program — first N signups get free full access
-- for a set number of days, using the existing bonus_subscription_
-- until mechanism already relied on for referral bonuses (see
-- lib/access.js) rather than inventing a new access-bypass path.
--
-- A singleton settings row (id always = 1) holds the whole program's
-- config, so the admin panel has exactly one thing to read and
-- write. Enrollment is enforced atomically in a database trigger,
-- not application code — two people signing up in the same instant
-- can't both claim the last slot, since the slot-claiming UPDATE
-- happens inside the same transaction as their signup and Postgres
-- serializes concurrent updates to the same row.
--
-- The existing on_auth_user_created trigger (which creates the
-- profiles row) is deliberately left untouched — this adds a
-- SEPARATE trigger on the same event instead of modifying a proven,
-- working piece of auth infrastructure. Trigger name is chosen to
-- sort alphabetically after the existing one, guaranteeing the
-- profiles row already exists by the time this trigger's UPDATE
-- runs (both fire inside the same transaction).
-- Run this once in Supabase SQL Editor after migration_048.
-- ============================================================

create table if not exists public.beta_program (
  id int primary key default 1,
  is_active boolean not null default false,
  max_slots int not null default 100,
  duration_days int not null default 30,
  slots_used int not null default 0,
  constraint beta_program_singleton check (id = 1)
);

insert into public.beta_program (id) values (1)
on conflict (id) do nothing;

alter table public.beta_program enable row level security;

create policy "Anyone can view beta program status" on public.beta_program
  for select using (true);

create or replace function public.claim_beta_slot_for_new_user()
returns trigger as $$
declare
  v_duration int;
begin
  update public.beta_program
  set slots_used = slots_used + 1
  where id = 1 and is_active = true and slots_used < max_slots
  returning duration_days into v_duration;

  if found then
    update public.profiles
    set bonus_subscription_until = greatest(coalesce(bonus_subscription_until, now()), now() + (v_duration || ' days')::interval)
    where id = new.id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created_beta_claim
  after insert on auth.users
  for each row execute procedure public.claim_beta_slot_for_new_user();
