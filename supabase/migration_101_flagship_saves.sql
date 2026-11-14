-- Migration 101: account cloud saves for the four flagship games (Midnight Burn, Operation Blacksite, Ashtide, Wrath of Olympus).
-- Paste ALL of this into Supabase > SQL Editor and click Run. It is safe to run again.
create table if not exists public.flagship_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null,
  data jsonb not null default '{}'::jsonb,   -- { "<storage key>": { "v": "<saved text>", "t": <millisecond stamp> } }
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
alter table public.flagship_saves enable row level security;
drop policy if exists "flagship_saves own select" on public.flagship_saves;
drop policy if exists "flagship_saves own insert" on public.flagship_saves;
drop policy if exists "flagship_saves own update" on public.flagship_saves;
create policy "flagship_saves own select" on public.flagship_saves for select using (auth.uid() = user_id);
create policy "flagship_saves own insert" on public.flagship_saves for insert with check (auth.uid() = user_id);
create policy "flagship_saves own update" on public.flagship_saves for update using (auth.uid() = user_id);
