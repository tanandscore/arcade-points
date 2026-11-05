-- ============================================================
-- Migration: Dominion (3D strategy) + multiplayer duel infrastructure
-- Run this once in Supabase SQL Editor after migration_010.
-- ============================================================

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('dominion', 'Dominion', '🗺️', 'Premium', '#ffb703', 'A real 19-territory 3D map. Conquer, grow, or both.', 'dominion', 'subscription', 'premium', null, null, 152, true),
  ('territoryduel', 'Territory Duel', '⚔️', 'Premium', '#ff5a3c', 'Real 1v1 multiplayer — no AI. Outplay an actual opponent.', 'territoryduel', 'subscription', 'premium', null, null, 157, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;

-- ------------------------------------------------------------
-- Duels: shared game state for turn-based multiplayer. A move is
-- NEVER written directly by a client — always through a server route
-- (/api/duels/*) using the service role, after validating it's really
-- that player's turn and the move is legal. Clients only ever READ
-- this table (for their own duels) and get live updates via Realtime
-- when the server writes a new state.
-- ------------------------------------------------------------
create table public.duels (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null,
  player1_id uuid references auth.users on delete cascade not null,
  player2_id uuid references auth.users on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  state jsonb not null default '{}'::jsonb,
  turn_user_id uuid,
  winner_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.duels enable row level security;

-- A player can see any open (waiting) duel, so they can find one to
-- join, plus any duel they're personally part of.
create policy "view own or waiting duels"
  on public.duels for select
  using (status = 'waiting' or auth.uid() = player1_id or auth.uid() = player2_id);

-- No insert/update policy for regular users on purpose — every write
-- goes through the service role inside /api/duels routes, which is
-- what makes this safe against a modified client trying to fake a
-- move or a win.

-- Required for the client to receive live updates (Realtime) when
-- the server writes a new state to a duel row.
alter publication supabase_realtime add table public.duels;
