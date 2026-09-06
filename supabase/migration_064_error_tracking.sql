-- ============================================================
-- Migration: Client-side error tracking.
--
-- Real production error monitoring — previously nothing existed at
-- all, confirmed directly before building this rather than assumed.
-- This session's own history is the concrete argument for it: the
-- Wrath of Olympus crash found and fixed earlier only came to light
-- because a real player happened to notice and report it, not
-- because anything caught it automatically.
--
-- Deliberately NOT using Sentry's official Next.js SDK here — real,
-- current research turned up a live, reproducible GitHub issue
-- (getsentry/sentry-javascript#22794) describing @sentry/nextjs
-- causing an unhandled promise rejection on every cold start
-- specifically on @opennextjs/cloudflare (this exact deployment
-- stack), because Cloudflare Workers forbid runtime WebAssembly
-- compilation, which Sentry's SDK attempts at module-evaluation
-- time. Adding error monitoring that itself introduces a new error
-- on every request isn't a trade worth making untested. This is a
-- genuine, first-party alternative instead, following the exact
-- same proven pattern performance_events already uses (see
-- migration_048) — same shape, same anyone-can-insert /
-- admin-only-can-read policy split.
--
-- Run this once in Supabase SQL Editor after migration_063.
-- ============================================================

create table if not exists public.error_events (
  id bigint generated always as identity primary key,
  message text not null,
  stack text,
  path text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.error_events enable row level security;

create policy "Anyone can submit an error event" on public.error_events
  for insert with check (true);

create policy "Admins can view error events" on public.error_events
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
