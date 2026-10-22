-- ============================================================
-- Migration: private user feedback
-- Run this once in Supabase SQL Editor after migration_013.
-- ============================================================

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  message text not null,
  created_at timestamptz default now()
);

alter table public.feedback enable row level security;

-- Users can submit feedback, but there is deliberately NO select
-- policy for regular users — feedback is never shown back to anyone,
-- including its own author, matching "not published externally."
-- Only the service role (used by the admin-only API route) can read it.
create policy "users can submit feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);
