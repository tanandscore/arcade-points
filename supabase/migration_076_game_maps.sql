-- ============================================================
-- Migration: per-map on/off switches
-- Lets an admin switch a single map of a game on or off without hiding the whole game.
-- A map with no row is ON. Safe to run more than once. Run once in the Supabase SQL Editor.
-- ============================================================
create table if not exists public.game_maps (
  game_slug text not null,
  map_id text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (game_slug, map_id)
);
alter table public.game_maps enable row level security;
drop policy if exists "Anyone can read map switches" on public.game_maps;
create policy "Anyone can read map switches" on public.game_maps for select using (true);
