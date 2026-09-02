-- ============================================================
-- Migration: Seasons (Phase 8) — the one phase needing a genuinely
-- new subsystem, correctly placed last since it's additive flavor on
-- top of a progression system (XP, achievements, streaks) that
-- needed to already be solid. No inventory or cosmetics system, as
-- specified — a season title is derived from season_xp the same way
-- level is derived from platform_xp (see lib/seasons.js), never
-- stored, so the title thresholds can change later with zero
-- migration.
--
-- increment_season_xp mirrors increment_platform_xp's atomicity
-- reasoning exactly, with an upsert (insert-or-increment) since a
-- user's first XP gain in a season has no existing row yet.
--
-- user_season_xp is readable by anyone (like achievements and season
-- definitions) rather than owner-only, since this is meant to be
-- shown on public profiles — the same reasoning already applied to
-- achievement unlocks in Phase 4.
-- Run this once in Supabase SQL Editor after migration_045.
-- ============================================================

create table if not exists public.seasons (
  id text primary key,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  badge_icon text not null
);

alter table public.seasons enable row level security;

create policy "Anyone can view season definitions" on public.seasons
  for select using (true);

create table if not exists public.user_season_xp (
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id text not null references public.seasons(id) on delete cascade,
  season_xp bigint not null default 0,
  primary key (user_id, season_id)
);

alter table public.user_season_xp enable row level security;

create policy "Anyone can view season xp" on public.user_season_xp
  for select using (true);

create or replace function public.increment_season_xp(p_user_id uuid, p_season_id text, p_amount integer)
returns void as $$
begin
  insert into public.user_season_xp (user_id, season_id, season_xp)
  values (p_user_id, p_season_id, greatest(p_amount, 0))
  on conflict (user_id, season_id)
  do update set season_xp = public.user_season_xp.season_xp + greatest(p_amount, 0);
end;
$$ language plpgsql security definer;

grant execute on function public.increment_season_xp(uuid, text, integer) to authenticated;

-- One real, live season so this feature isn't shipped empty.
insert into public.seasons (id, name, starts_at, ends_at, badge_icon)
values ('season-1', 'Founders Season', now(), now() + interval '90 days', '🌟')
on conflict (id) do nothing;
