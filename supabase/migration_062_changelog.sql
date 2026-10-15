-- ============================================================
-- Migration: "What's new" changelog — real content, real unread
-- tracking, not just a static list nobody has a reason to check.
--
-- changelog_entries: admin-authored updates, one row per real
-- change worth telling players about. game_slug is nullable —
-- site-wide updates (like this one) don't belong to a single game.
--
-- user_changelog_reads: one row per user, storing only the last
-- time they viewed /changelog. Unread count is computed as
-- "entries published after this timestamp" rather than tracking
-- read/unread per entry — far simpler, and the only thing the UI
-- actually needs (a badge count, not per-entry read receipts).
--
-- Run this once in Supabase SQL Editor after migration_061.
-- ============================================================

create table if not exists public.changelog_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  game_slug text,
  published_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.changelog_entries enable row level security;

create policy "Anyone can view changelog entries" on public.changelog_entries
  for select using (true);

create table if not exists public.user_changelog_reads (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default '2000-01-01'
);

alter table public.user_changelog_reads enable row level security;

create policy "Users can view own changelog read state" on public.user_changelog_reads
  for select using (auth.uid() = user_id);

create policy "Users can upsert own changelog read state" on public.user_changelog_reads
  for insert with check (auth.uid() = user_id);

create policy "Users can update own changelog read state" on public.user_changelog_reads
  for update using (auth.uid() = user_id);
