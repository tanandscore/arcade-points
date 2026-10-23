-- Migration 083: saves each player's Legend Pass progress (mastery rank, daily mission, challenge bests) to their account.
-- Paste ALL of this into Supabase > SQL Editor and click Run. It is safe to run again.
create table if not exists public.legend_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
alter table public.legend_progress enable row level security;
drop policy if exists "legend_progress own select" on public.legend_progress;
drop policy if exists "legend_progress own insert" on public.legend_progress;
drop policy if exists "legend_progress own update" on public.legend_progress;
create policy "legend_progress own select" on public.legend_progress for select using (auth.uid() = user_id);
create policy "legend_progress own insert" on public.legend_progress for insert with check (auth.uid() = user_id);
create policy "legend_progress own update" on public.legend_progress for update using (auth.uid() = user_id);
